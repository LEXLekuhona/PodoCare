/** Единые пользовательские формулировки (prod). */

/** Офлайн: заглушка экрана и ошибки чтения без кэша. */
export const USER_OFFLINE_NO_CACHED_DATA = 'Отсутствует подключение к Интернету';

/** Сообщение при неудачном GET офлайн (синоним по смыслу с заглушкой экрана). */
export const USER_OFFLINE_READ_FAILED = USER_OFFLINE_NO_CACHED_DATA;

export const USER_SERVER_NO_CACHED_DATA = 'Сервер недоступен. Попробуйте позже.';

export const USER_MUTATION_OFFLINE = 'Невозможно выполнить действие без подключения к Интернету.';

export const USER_MUTATION_SERVER = 'Невозможно выполнить действие: сервер недоступен. Попробуйте позже.';

export const USER_REQUEST_TIMEOUT =
  'Время ожидания ответа истекло. Проверьте подключение к Интернету или попробуйте позже.';

/** Только dev: подсказка поднять стек. */
export const DEV_NETWORK_HINT =
  'Нет связи с сервером. В корне проекта выполните: pnpm dev:stack:infra или pnpm dev:android.';
