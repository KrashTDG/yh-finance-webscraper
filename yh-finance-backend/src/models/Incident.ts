import mongoose, { Document, Schema } from 'mongoose';

export interface IIncident extends Document {
    title: string;
    description?: string;
    source: string;
    severity: 'info' | 'warning' | 'critical';
    status: 'triggered' | 'acknowledged' | 'resolved';
    createdAt: Date;
    resolvedAt?: Date;
}

const incidentSchema = new Schema<IIncident>({
    title: { type: String, required: true },
    description: { type: String },
    source: { type: String, default: 'Backend-Server' }, 
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    status: { type: String, enum: ['triggered', 'acknowledged', 'resolved'], default: 'triggered' },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date }
});

export const Incident = mongoose.model<IIncident>('Incident', incidentSchema);