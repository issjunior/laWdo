/**
 * Exportação de todos os schemas de validação Zod
 *
 * Este arquivo centraliza a exportação de todos os validadores
 * para facilitar a importação em outros módulos.
 */

// User (Perito)
export * from "./user.schema"

// Solicitante
export * from "./solicitante.schema"

// TipoExame
export * from "./tipo-exame.schema"

// REP (Requisição de Exame Pericial)
export * from "./rep.schema"

// Laudo
export * from "./laudo.schema"

// ImagemLaudo
export * from "./imagem-laudo.schema"

// Placeholder
export * from "./placeholder.schema"

// LogAuditoria
export * from "./log-auditoria.schema"

// Template
export * from "./template.schema"

// Tipos consolidados para facilitar importação
export type {
  User,
  CreateUserInput,
  UpdateUserInput,
  LoginInput,
  UserResponse,
} from "./user.schema"

export type {
  Solicitante,
  CreateSolicitanteInput,
  UpdateSolicitanteInput,
  SolicitanteResponse,
} from "./solicitante.schema"

export type {
  TipoExame,
  CreateTipoExameInput,
  UpdateTipoExameInput,
  TipoExameResponse,
} from "./tipo-exame.schema"

export type {
  REP,
  CreateREPInput,
  UpdateREPInput,
  UpdateREPStatusInput,
  AtribuirPeritoREPInput,
  REPResponse,
} from "./rep.schema"

export type {
  Laudo,
  CreateLaudoInput,
  UpdateLaudoInput,
  UpdateLaudoStatusInput,
  CriarNovaVersaoLaudoInput,
  AssinarLaudoInput,
  LaudoResponse,
} from "./laudo.schema"

export type {
  ImagemLaudo,
  CreateImagemLaudoInput,
  UpdateImagemLaudoInput,
  ReordenarImagensInput,
  ImagemLaudoResponse,
} from "./imagem-laudo.schema"

export type {
  Placeholder,
  CreatePlaceholderInput,
  UpdatePlaceholderInput,
} from "./placeholder.schema"

export type {
  LogAuditoria,
  CreateLogAuditoriaInput,
  ConsultarLogsInput,
  LogAuditoriaResponse,
} from "./log-auditoria.schema"

export type {
  Template,
  CreateTemplateInput,
  UpdateTemplateInput,
  SecaoTemplate,
  CreateSecaoTemplateInput,
  UpdateSecaoTemplateInput,
} from "./template.schema"

/**
 * Mapa de schemas por nome de entidade
 */
export const schemas = {
  user: {
    schema: import("./user.schema").then(m => m.userSchema),
    create: import("./user.schema").then(m => m.createUserSchema),
    update: import("./user.schema").then(m => m.updateUserSchema),
    response: import("./user.schema").then(m => m.userResponseSchema),
  },
  solicitante: {
    schema: import("./solicitante.schema").then(m => m.solicitanteSchema),
    create: import("./solicitante.schema").then(m => m.createSolicitanteSchema),
    update: import("./solicitante.schema").then(m => m.updateSolicitanteSchema),
    response: import("./solicitante.schema").then(m => m.solicitanteResponseSchema),
  },
  tipoExame: {
    schema: import("./tipo-exame.schema").then(m => m.tipoExameSchema),
    create: import("./tipo-exame.schema").then(m => m.createTipoExameSchema),
    update: import("./tipo-exame.schema").then(m => m.updateTipoExameSchema),
    response: import("./tipo-exame.schema").then(m => m.tipoExameResponseSchema),
  },
  rep: {
    schema: import("./rep.schema").then(m => m.repSchema),
    create: import("./rep.schema").then(m => m.createRepSchema),
    update: import("./rep.schema").then(m => m.updateRepSchema),
    response: import("./rep.schema").then(m => m.repResponseSchema),
  },
  laudo: {
    schema: import("./laudo.schema").then(m => m.laudoSchema),
    create: import("./laudo.schema").then(m => m.createLaudoSchema),
    update: import("./laudo.schema").then(m => m.updateLaudoSchema),
    response: import("./laudo.schema").then(m => m.laudoResponseSchema),
  },
  imagemLaudo: {
    schema: import("./imagem-laudo.schema").then(m => m.imagemLaudoSchema),
    create: import("./imagem-laudo.schema").then(m => m.createImagemLaudoSchema),
    update: import("./imagem-laudo.schema").then(m => m.updateImagemLaudoSchema),
    response: import("./imagem-laudo.schema").then(m => m.imagemLaudoResponseSchema),
  },
  placeholder: {
    schema: import("./placeholder.schema").then(m => m.placeholderSchema),
    create: import("./placeholder.schema").then(m => m.createPlaceholderSchema),
    update: import("./placeholder.schema").then(m => m.updatePlaceholderSchema),
    response: import("./placeholder.schema").then(m => m.placeholderResponseSchema),
  },
  logAuditoria: {
    schema: import("./log-auditoria.schema").then(m => m.logAuditoriaSchema),
    create: import("./log-auditoria.schema").then(m => m.createLogAuditoriaSchema),
    response: import("./log-auditoria.schema").then(m => m.logAuditoriaResponseSchema),
  },
  template: {
    schema: import("./template.schema").then(m => m.templateSchema),
    create: import("./template.schema").then(m => m.createTemplateSchema),
    update: import("./template.schema").then(m => m.updateTemplateSchema),
  },
}