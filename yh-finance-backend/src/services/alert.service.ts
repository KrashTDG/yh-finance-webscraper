import axios from 'axios';
import { Incident, IIncident } from '../models/Incident';

export const triggerIncident = async (title: string, description: string, severity: IIncident['severity'] = 'warning', source: string = 'Backend-Server') => {
    try {
        const newIncident = new Incident({ title, description, severity, source });
        await newIncident.save();
        
        console.log(`\n🚨 [INCIDENT TRIGGERED] [${severity.toUpperCase()}]`);
        console.log(`Issue: ${title}\n`);

        const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL; 
        if (WEBHOOK_URL && severity === 'critical') {
            await axios.post(WEBHOOK_URL, {
                content: `🚨 **CRITICAL INCIDENT** 🚨\n**Service:** ${source}\n**Issue:** ${title}\n**Details:** ${description}`
            });
        }
    } catch (dbErr: any) {
        console.error("CRITICAL METADATA FAILURE:", dbErr.message);
    }
};