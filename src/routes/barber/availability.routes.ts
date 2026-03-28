import { Router } from 'express';
import { availabilityController } from '../../modules/barberAvailability/barberAvailability.container';

const router = Router();

router.post('/availability/presets', availabilityController.createPreset);
router.get('/availability/presets', availabilityController.listPresets);
router.delete('/availability/presets/:presetId', availabilityController.deletePreset);
router.post('/availability/presets/:presetId/apply', availabilityController.applyPreset);

// need check booking conflict before update ( not implimented yet waiting for booking module completion)
router.put('/availability/today', availabilityController.setAvailability);
router.get('/availability/today/default', availabilityController.getDefault);
router.get('/availability/today', availabilityController.getAvailability);

export default router;
