const {executeSQL} = require('../mariadb')


async function getSystems() {
    const systems = ['stanton','pyro']
    return await executeSQL("SELECT * FROM v_systems where code in ?", [systems])
}

async function getSystem(id) {
    system = {}
    const rows = await executeSQL("SELECT * from locs_view where id = ?", [id])
    if(rows.length > 0) { // rows + meta info
        system = rows[0]
    }
    return system;
}

async function getLocations(id) {
    return await executeSQL('SELECT * locs where parent_id = ?', [parseInt(id)])
}

async function getPOIs(id) {
    return await executeSQL("SELECT * FROM poi_view where system_id = ?", [id])
}

module.exports = {
    getSystems,
    getSystem, 
    getLocations, 
    getPOIs
}