import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Incident } from '../models/Incident';

export const getIncidents = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const incidents = await Incident.find().sort({ createdAt: -1 }).limit(50);
        res.json(incidents);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch system logs" });
    }
};

export const acknowledgeIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const updated = await Incident.findByIdAndUpdate(req.params.id, { status: 'acknowledged' }, { new: true });
        res.json({ message: "Incident acknowledged", updated });
    } catch (err) {
        res.status(500).json({ error: "Could not acknowledge incident" });
    }
};

export const resolveIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const updated = await Incident.findByIdAndUpdate(req.params.id, { status: 'resolved', resolvedAt: Date.now() }, { new: true });
        res.json({ message: "Incident resolved", updated });
    } catch (err) {
        res.status(500).json({ error: "Could not update incident" });
    }
};