import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { IncidentSchema } from '../../packages/contracts/src';
const cases: {name:string;valid:boolean;payload:unknown}[]=JSON.parse(readFileSync('packages/contracts/examples.json','utf8'));
for(const sample of cases)it(`contrato compartilhado: ${sample.name}`,()=>expect(IncidentSchema.safeParse(sample.payload).success).toBe(sample.valid));
