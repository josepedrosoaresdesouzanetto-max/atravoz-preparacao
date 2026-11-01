import { z } from 'zod';
export const IncidentSchema = z.object({
  schema_version: z.literal(1), incident_id: z.uuid(),
  created_at: z.iso.datetime({offset:true}), record_type: z.enum(['help','witness']),
  description: z.string().max(4000), synthetic: z.literal(true),
});
export type Incident = z.infer<typeof IncidentSchema>;
