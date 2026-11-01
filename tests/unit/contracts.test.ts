import { describe, expect, it } from 'vitest';
import { IncidentSchema } from '../../packages/contracts/src';
describe('contrato inicial', () => {
  it('aceita relato mínimo sem GPS', () => expect(IncidentSchema.parse({schema_version:1,incident_id:crypto.randomUUID(),created_at:new Date().toISOString(),record_type:'help',description:'',synthetic:true}).description).toBe(''));
  it('rejeita versão incompatível', () => expect(IncidentSchema.safeParse({schema_version:99}).success).toBe(false));
});
