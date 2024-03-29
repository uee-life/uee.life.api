const { v4: uuid } = require('uuid')
const { executeSQL } = require('../mariadb')

const{ manager } = require('../manager')

async function setVerificationCode(user, code) {
    // delete old code
    await executeSQL("DELETE FROM verification WHERE email = ?", [user.email]);

    // add new code
    await executeSQL("INSERT INTO verification (email, vcode) value (?, ?)", [user.email, code]);
}

async function getVerificationCode(user) {
    code = "";
    const rows = await executeSQL("SELECT vcode from verification where email = ?", [user.email]);
    if(rows.length > 0) { // rows + meta info
        code = rows[0].vcode
    } else {
        code = uuid();
        await setVerificationCode(user, code);
    }
    return code;
}

async function setVerified(user) {
    var params = {
        id: user.user_id
    }
    var metadata = {
        handle_verified: true
    }
    const usr = await manager.updateAppMetadata(params, metadata).then(function(res) {
        return res
    }).catch(function(err) {
        console.error(err)
        return null
    })
    return usr
}

module.exports = {
    getVerificationCode,
    setVerificationCode,
    setVerified
}