/**
 * Точка входа пакета общих типов.
 *
 * Здесь собираются типы, enum'ы и константы, которые должны совпадать
 * между бэкендом и всеми клиентами (mobile, tablet, admin).
 *
 * Часть типов (DTO, ответы API) со временем будет генерироваться автоматически
 * из OpenAPI-схемы, которую отдаёт NestJS Swagger.
 */

export * from './enums';
export * from './common';
export * from './content-contracts';
export * from './support-contracts';
