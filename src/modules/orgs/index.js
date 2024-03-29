const { cache, checkJwt } = require('../helper')
const router = require('express').Router()

const {
    getOrganization, 
    getOrgFounders, 
    getOrgMembers,
    getOrgShips
} = require('./model');

const {
    getFleetList,
    addFleet
} = require('../fleet/model')

/**
 * This has to use tag as this may be requesting an org we don't have
 * in our DB yet.
 **/
router.get('/orgs/:tag', cache(60), async (req, res) => {
    res.send(await getOrganization(req.params.tag));
});

router.get('/orgs/:id/founders', cache(60), async (req, res) => {
    res.send(await getOrgFounders(req.params.id));
});

router.get('/orgs/:id/members', async (req, res) => {
    const page = req.query.page || 1
    res.send(await getOrgMembers(req.params.id, page, true));
})

router.get('/orgs/:id/affiliates', async (req, res) => {
    const page = req.query.page || 1
    res.send(await getOrgMembers(req.params.id, page, false));
})

router.get('/orgs/:orgID/fleets', async (req, res) => {
    res.send(await getFleetList(req.params.orgID))
})

router.post('/orgs/:orgID/fleets', checkJwt, async (req, res) => {
    const data = {
        cmdr: req.body.cmdr,
        name: req.body.name,
        purpose: req.body.purpose,
        type: 1,
        owner: parseInt(req.params.orgID)
    }
    res.send(await addFleet(req.user, data))
})

router.get('/orgs/:id/ships', async (req, res) => {
    res.send(await getOrgShips(req.params.id, 0))
})

// Get unused ship pool for specified fleet
router.get('/orgs/:id/ships/:fleet', async (req, res) => {
    res.send(await getOrgShips(req.params.id, req.params.fleet))
})

module.exports = router
