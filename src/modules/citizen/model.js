
const { executeSQL } = require('../mariadb')

const { getUser } = require('../user/model')
const { fetchCitizen } = require('../../helpers/rsi')
const { getID } = require('../../helpers/db')
const { syncCitizen } = require('../user/model')

/*
*   GET /citizen/<handle>
*/
async function getCitizen(handle) {
    console.log('in getCitizen')
    let citizen = {}
    citizen.info = await loadCitizen(handle)
    if(citizen.info) {
        citizen.ships = []
        citizen.home = await loadCitizenLocation(handle)
    } else {
        citizen.info = await fetchCitizen(handle)
        citizen.ships = []
        citizen.home = {
            system: null,
            location: null,
            base: null
        }
    }

    return citizen
};


async function loadCitizen(handle) {
    let data = {}
    let citizen = null

    let sql = "select id, created FROM citizen WHERE handle=?"
    let rows = await executeSQL(sql, [handle])

    if(rows.length > 0) {
        // user found
        data = rows[0]

        sql = "select * from citizen_sync where handle=?"
        rows = await executeSQL(sql, [handle])

        if(rows.length > 0) {
            citizen = rows[0]
        } else {
            // no sync data for some reason, but is verified. Sync data and try again.
            console.log('sync needed...')
            citizen = await syncCitizen(handle)
            console.log(citizen)
        }

        citizen.id = data.id
        citizen.created = data.created
        citizen.verified = true
    }

    return citizen
}

async function loadCitizenLocation(handle) {
    console.log('loading citizen location')
    let home = {
        system: null,
        location: null,
        base: null
    }
    sql_system = "SELECT b.id, b.name FROM locs b LEFT JOIN citizen a ON a.home_system = b.id WHERE a.handle=?"
    sql_location = "SELECT b.id, b.name FROM locs b LEFT JOIN citizen a ON a.home_location = b.id WHERE a.handle=?"
    sql_base = "SELECT b.id, b.name FROM pois b LEFT JOIN citizen a ON a.home_base = b.id WHERE a.handle=?"
    const rows = await executeSQL(sql_system, [handle])
    if(rows.length > 0) {
        home.system = rows[0]
        const lrows = await executeSQL(sql_location, [handle])
        if(lrows.length > 0) {
            home.location = lrows[0]
            const brows = await executeSQL(sql_base, [handle])
            if(brows.length > 0) {
                home.base = brows[0]
            }
        }
    }
    return home
}



async function getInfo(handle) {
    citizen = await getCitizen(handle)
    const info = citizen.info
    info.id = citizen.id
    return info
}

async function getShips(handle) {
    sql = "select a.id, a.name, c.short_name, c.make, c.make_abbr, c.model, c.size, c.max_crew, c.cargo, c.type, c.focus from ship_map a left join citizen b on a.citizen = b.id left join ship_view c on a.ship = c.id where b.handle=?"
    const ships = await executeSQL(sql, [handle])
    return ships
}

async function addShip(usr, ship) {
    const user = await getUser(usr)
    const id = await getID(user.app_metadata.handle)
    let args = [id, ship.id, ship.name]
    const res = await executeSQL("INSERT INTO ship_map (citizen, ship, name) VALUES (?, ?, ?)", args)
    console.log(res)
    const ship_id = await executeSQL("SELECT id FROM ship_map WHERE ship = ?", [ship.id])
    args = [ship_id[0].id, user.app_metadata.handle, 1]
    await executeSQL("INSERT INTO ship_crew (ship, citizen, role) values (?, ?, ?)", args)
}

async function removeShip(usr, ship) {
    const user = await getUser(usr)
    const id = await getID(user.app_metadata.handle)
    const sql = "DELETE FROM ship_map WHERE citizen=? AND id=?"
    const args = [id, ship]
    console.log(args)
    const res = await executeSQL(sql, args)
    console.log(res)
}

async function getLocation(handle) {
    citizen = await getCitizen(handle)
    return citizen.home
}

async function saveLocation(handle, loc) {
    const sql = "UPDATE citizen SET home_system = ?, home_location = ?, home_base = ? WHERE handle=?"
    const system = loc.system ? loc.system.id : null
    const location = loc.location ? loc.location.id : null
    const base = loc.base ? loc.base.id : null
    const args = [system, location, base, handle]
    console.log(args)
    const res = await executeSQL(sql, args)
    console.log(res)
}

async function setLocation(token, handle, location) {
    const user = await getUser(token)

    if(handle == user.app_metadata.handle) {
        await saveLocation(handle, location)
        user.citizen = await getCitizen(handle)
        user.citizen.home = location
        return {
            success: true,
            error: "",
            user: user   // user with verified flag set
        }
    } else {
        return {
            success: false,
            error: "Cannot edit another citizen's location!",
            user: user
        }
    }
}

async function createCitizen(handle) {
    console.log("Creating citizen: " + handle)
    // try to load citizen from DB
    const rows = await executeSQL("SELECT * FROM citizen WHERE handle=?", [handle])

    if(rows.length === 0) {
        // if no record, add new record
        await executeSQL("INSERT INTO citizen (handle) values (?)", [handle])
        await syncCitizen(handle)
    }
}

module.exports = {
    getCitizen,
    fetchCitizen,
    getInfo,
    getShips,
    addShip,
    removeShip,
    getLocation,
    setLocation,
    createCitizen
}