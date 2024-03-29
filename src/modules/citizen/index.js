const { cache, checkJwt } = require('../helper')
const router = require('express').Router()

const {
    searchCitizen,
    getCitizen,
    getInfo, 
    getLocation,
    getShips,
    addShip,
    removeShip,
    setLocation,
    getAssignments,
    startSync
} = require('./model');

const {
    verifyCitizen
} = require('../verification')

router.post('/citizen/search', async (req, res) => {
    res.send(await searchCitizen(req.body))
})

// retrieve citizen basic info
router.get('/citizens/:handle', cache(600), async (req, res) => {
    res.send(await getCitizen(req.params.handle))
})

router.get('/citizens/:handle/info', cache(600), async (req, res) => {
    res.send(await getInfo(req.params.handle))
})

router.get('/citizens/:handle/ships', async (req, res) => {
    res.send(await getShips(req.params.handle))
});

router.get('/citizen/:handle/assignments', async (req, res) => {
    res.send(await getAssignments(req.params.handle))
})

// Protected
router.post('/citizens/:handle/ships', checkJwt, async (req, res) => {
    res.send(await addShip(req.user, req.body))
});

// Protected
router.delete('/citizens/:handle/ships/:id', checkJwt, async (req, res) => {
    res.send(await removeShip(req.user, req.params.id))
})

router.get('/citizens/:handle/location', cache(600), async(req, res) => {
    res.send(await getLocation(req.params.handle))
})

// Protected
router.put("/citizens/:handle/location", checkJwt, async (req, res) => {
    res.send(await setLocation(req.user, req.params.handle, req.body))
})

module.exports = router