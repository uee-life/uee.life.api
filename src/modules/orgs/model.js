const { executeSQL } = require('../mariadb')
const { getOrgID, getHandle } = require('../../helpers/db')
const { getCitizen } = require ('../citizen/model')
const { fetchOrgFounders, fetchOrg, fetchMembers } = require("../../helpers/rsi")

//TODO: Do something with this...
async function checkOrgID(param) {
    if (parseInt(param)) {
        return parseInt(param)
    } else {
        return await getOrgID(param)
    }
}

async function getOrgFounders(org) {
    return await fetchOrgFounders(org)
}

async function getOrganization(tag) {
    const org = await fetchOrg(tag)
    const orgID = await getOrgID(tag)
    org.id = orgID
    return org
}

async function getOrgMembers(org, page=1, isMain=true) {
    if(!parseInt(page)) {
        page = 1
    }
    members = await fetchMembers(org, page, isMain)

    return members
}

async function getOrgShips(org, fleet) {
    let rows = []
    if (fleet) {
        const sql = "select * from v_ship_map where tag=? and not exists (select * from fleet_ships where fleet_ships.fleet=? and  fleet_ships.ship = v_ship_map.id)"
        rows = await executeSQL(sql, [org, fleet])
    } else {
        const sql = 'select * from v_ship_map where tag=?'
        rows = await executeSQL(sql, [org])
    }
    
    let ships = []
    if (rows.length > 0) {
        for (i in [...Array(rows.length).keys()]) {
            ship = rows[i]
            const owner = await getCitizen(await getHandle(ship.citizen))
            ship.owner = owner.info
            ships.push(ship)
        }
        return ships
    } else {
        return []
    }
}

module.exports = {
    getOrganization,
    getOrgFounders,
    getOrgMembers,
    getOrgShips
};
