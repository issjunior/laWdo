import { app } from 'electron';

const diretorioTemporarioSmoke = process.env.LAWDO_SMOKE_USER_DATA;
if (process.env.LAWDO_SMOKE_SCHEMA === '1' && diretorioTemporarioSmoke) {
  app.setPath('userData', diretorioTemporarioSmoke);
}

await import('./index.js');
