const express = require('express');
const router = express.Router();
const potholeController = require('../controllers/potholeController');

// POST /api/pothole - Receive pothole detection from AI or sensor
router.post('/', potholeController.createPothole);

// GET /api/potholes - Get all potholes with optional filters
router.get('/', potholeController.getAllPotholes);

// GET /api/pothole/:id - Get a single pothole
router.get('/:id', potholeController.getPotholeById);

// PATCH /api/pothole/:id - Update pothole status/details
router.patch('/:id', potholeController.updatePothole);

// DELETE /api/pothole/:id - Delete a pothole
router.delete('/:id', potholeController.deletePothole);

module.exports = router;
