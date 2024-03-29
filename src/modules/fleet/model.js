const {executeSQL} = require('../mariadb')

const { getHandle, getOrgTag, getOrgRank, getID } = require('../../helpers/db')
const { getUser } = require('../user/model')
const { getCitizen } = require ('../citizen/model')

async function canEdit(usr, group) {
    const user = await getUser(usr)
    const id = await getID(user.app_metadata.handle)
    let cmdrs = []
    if (group.id) {
        cmdrs = await getCommanders(group.id)
    } 
    
    let edit = false
    switch (group.type) {
        case 1: // org fleet
            const rank = await getOrgRank(group.owner, id)
            if (parseInt(rank) === 5 || cmdrs.includes(user.app_metadata.handle)) {
                console.log('Can Edit')
                edit = true
            } else {
                console.log('Cannot Edit')
            }
            break;
        case 2: // personal fleet
            console.log('hit case 2')
            if (group.owner === id) {
                edit = true
            }
            break;
        default:
            edit = false
    }
    return edit
}

// fleet functions

async function getFleetList(orgTag) {
    return await executeSQL('SELECT a.*, b.tag as org_tag FROM v_fleets a left join org b on a.owner = b.id WHERE a.type=1 and b.tag=?', [orgTag])
}

async function addFleet(usr, data) {
    // TODO: check user CAN add to this owner
    if (await canEdit(usr, data)) {
        const sql = "INSERT INTO fleet_groups (type, owner, parent, name, purpose, cmdr) VALUES (?,?,?,?,?,?)"
        const params = [data.type, data.owner, 0, data.name, data.purpose, data.cmdr]
        const res = await executeSQL(sql, params)
        // TODO: check the sql result
        return {success: 1, msg: 'Fleet Added!'}
    } else {
        return {success: 0, msg: 'No permissions to add a fleet'}
    }
}

// fleet group functions

async function getGroup(groupID) {
    // use a recursive query to retrieve all squadrons (groups) for given fleet
    const sql = "SELECT * FROM fleet_groups WHERE id=?"
    const rows = await executeSQL(sql, [groupID])

    if (rows.length > 0) {
        const group = rows[0]
        if (group.type === 1) {
            group.org_tag = await getOrgTag(group.owner)
        } else if (fleet.type === 2) {
            group.handle = await getHandle(group.owner)
        }
        return group
    } else {
        return {}
    }
}

async function addGroup (usr, groupID, data) {
    const edit = await canEdit(usr, await getGroup(groupID))

    if (edit) {
        console.log(data)
        // get parent groups type
        const rows = await executeSQL("SELECT type FROM fleet_groups WHERE id=?", [groupID])
        if (rows.length > 0) {
            const type = rows[0].type
            const sql = "INSERT INTO fleet_groups (type, parent, owner, name, purpose, cmdr) values (?, ?, ?, ?, ?, ?)"
            await executeSQL(sql, [type, groupID, data.owner, data.name, data.purpose, data.cmdr])
            return {success: 1, msg: 'Group added!'}
        } else {
            return {success: 0, msg: 'Failed adding group. Invalid parent group specified'}
        }
    } else {
        return {success: 0, msg: 'No permissions to add group to this fleet'}
    }
}

async function removeGroup(usr, groupID) {
    // check usr owns org that owns the fleet
    if (await canEdit(usr, await getGroup(groupID))) {
        // remove all crew in the fleet group
        await executeSQL('DELETE FROM fleet_personnel WHERE id in (select id from v_fleet_crew where `group`=?)', [groupID])

        // remove all ships in the fleet group
        await executeSQL('DELETE FROM fleet_ships WHERE parent=?', [groupID])

        // delete the fleet group
        await executeSQL('DELETE FROM fleet_groups WHERE id=?', [groupID])

        return {success: 1, msg: 'Group Removed!'}
    } else {
        return {success: 0, msg: 'No permission to remove this fleet group'}
    }
}

async function updateGroup(usr, groupID, data) {
    if (await canEdit(usr, await getGroup(groupID))) {
        // TODO: Check permission
        const sql = "UPDATE fleet_groups SET cmdr=?, name=?, purpose=? WHERE id=?"
        await executeSQL(sql, [data.cmdr, data.name, data.purpose, groupID])
        return {success: 1, msg: 'Fleet Updated!'}
    } else {
        return {success: 0, msg: 'No permission to update fleet group'}
    }
}

async function getSubgroups(parent) {
    const rows = await executeSQL("SELECT * FROM fleet_groups WHERE parent=?", [parent])
    if (rows.length > 0) {
        return rows
    } else {
        return []
    }
}

// ship functions

async function getShipGroupID(fleetID, shipID) {
    const rows = await executeSQL('SELECT parent FROM fleet_ships WHERE fleet=? AND ship=?', [fleetID, shipID])
    if (rows.length > 0) {
        return rows[0].parent
    } else {
        return 0
    }
}

async function getShipGroup(fleetID, shipID) {
    const groupID = await getShipGroupID(fleetID, shipID)
    return await getGroup(groupID)
}

async function getShips (groupID) {
    const rows = await executeSQL('SELECT * FROM fleet_ships LEFT JOIN v_ship_map ON fleet_ships.ship = v_ship_map.id WHERE parent=?', [groupID])

    let ships = []

    if (rows.length > 0) {
        for (i in [...Array(rows.length).keys()]) {
            ship = rows[i]
            const owner = await getCitizen(await getHandle(ship.citizen))
            const crew = await getShipCrew(ship.fleet, ship.ship)
            ship.owner = owner.info
            ship.crew = crew.length
            ships.push(ship)
        }
        return ships
    } else {
        return []
    }
}

async function getShip (fleetID, shipID) {
    const rows = await executeSQL('SELECT * FROM fleet_ships LEFT JOIN v_ship_map ON fleet_ships.ship = v_ship_map.id WHERE fleet=? and ship=?', [fleetID, shipID])

    if (rows.length > 0) {
        ship = rows[0]
        const owner = await getCitizen(await getHandle(ship.citizen))
        ship.owner = owner.info
        return ship
    } else {
        return {}
    }
}

async function addShip (usr, fleetID, data) {
    if (await canEdit(usr, await getGroup(data.group))) {
        console.log('adding ship', data)
        const sql = "INSERT INTO fleet_ships (fleet, parent, ship) values (?, ?, ?)"
        await executeSQL(sql, [fleetID, data.group, data.ship])
        return {success: 1, msg: 'Ship added!'}
    } else {
        return {success: 0, msg: 'No permissions to add a ship to this fleet group'}
    }
}

async function removeShip (usr, groupID, shipID) {
    if (await canEdit(usr, await getGroup(groupID))) {
        // remove crew first
        await executeSQL('DELETE FROM fleet_personnel WHERE ship=? and id in (select id from v_fleet_crew where `group`=?)', [shipID, groupID])

        const sql = "DELETE FROM fleet_ships WHERE parent=? AND ship=?"
        await executeSQL(sql, [groupID, shipID])
        return {success: 1, msg: 'Ship removed!'}
    } else {
        return {success: 0, msg: 'No permission to remove ship from this fleet group'}
    }
}

// crew functions

async function getShipCrew(fleetID, shipID) {
    // retrieve the crew compliment for the provided fleet ship
    const groupID = await getShipGroupID(fleetID, shipID)
    const crew = await executeSQL('SELECT * FROM v_fleet_crew WHERE `group`=? AND `ship`=?', [groupID, shipID])
    return crew
}

async function getAllCrew(fleetID) {
    // get all crewmembers for the whole fleet
    const rows = await executeSQL('SELECT * FROM v_fleet_crew WHERE fleet=?', [fleetID])
    let crew = []

    if (rows.length > 0) {
        for (i in [...Array(rows.length).keys()]) {
            c = rows[i]
            const group = await getGroup(c.group)
            c.group = group
            crew.push(c)
        }
    } else {
        return []
    }
    return crew
}

async function addCrew(usr, fleetID, shipID, data) {

    if (await canEdit(usr, await getShipGroup(fleetID, shipID))) {
        // add a crewmen to the specified fleet ship
        // check if crewmember is already in the fleet
        const rows = await executeSQL('SELECT * FROM fleet_personnel WHERE fleet=? AND citizen=?', [fleetID, data.handle])
        if (rows.length > 0) {
            return {success: 0, msg: 'That Citizen is already assigned to the fleet!'}
        } else {
            await executeSQL('INSERT INTO fleet_personnel (fleet, ship, citizen, role) VALUES (?, ?, ?, ?)', [fleetID, shipID, data.handle, data.role])
            return {success: 1, msg: 'Successfully added crewmember!'}
        }
    } else {
        return {success: 0, msg: 'No permission to edit the crew of this fleet ship'}
    }
}

async function updateCrew(usr, fleetID, shipID, crewID, data) {
    if (await canEdit(usr, await getShipGroup(fleetID, shipID))) {

        /*
         we check fleet and ship ID's here even though it's redundant to make sure people cant bypass the edit check
         by specifying a fleet and ship they can edit, but an arbitrary crewID
         */
        await executeSQL('UPDATE fleet_personnel SET role=? WHERE fleet=? AND ship=? AND id=?', [data.role, fleetID, shipID, crewID])
        return {success: 1, msg: 'Successfully updated crewmember!'}
    } else {
        return {success: 0, msg: 'No permission to edit the crew of this fleet ship'}
    }
}

async function removeCrew(usr, fleetID, shipID, crewID) {
    if (await canEdit(usr, await getShipGroup(fleetID, shipID))) {
        // remove the specified crewmember
        // also checks FleetID to ensure edit check is enforced
        await executeSQL('DELETE FROM fleet_personnel WHERE fleet=? AND ship=? AND id=?', [fleetID, shipID, crewID])
        return {success: 1, msg: 'Successfully removed crewmember!'}
    } else {
        return {success: 0, msg: 'No permission to edit the crew of this fleet ship'}
    }
}

async function getCommanders(fleetID) {
    let commanders = []
    const rows = await executeSQL('SELECT cmdr, parent FROM fleet_groups WHERE id=?', [fleetID])
    if (rows.length > 0) {
        const data = rows[0]

        if (data.cmdr) {
            commanders.push(data.cmdr)
        }
        if (data.parent !== 0) { // fleet root group
            commanders = commanders.concat(await getCommanders(data.parent))
        }

        return commanders
    } else {
        return []
    }
}

module.exports = {
    // fleet functions
    getFleetList,
    addFleet,
    // group functions
    getGroup,
    addGroup,
    removeGroup,
    updateGroup,
    getSubgroups,
    // ship functions
    getShips,
    getShip,
    addShip,
    removeShip,
    // crew functions
    getAllCrew,
    getShipCrew,
    addCrew,
    updateCrew,
    removeCrew,
    getCommanders
}