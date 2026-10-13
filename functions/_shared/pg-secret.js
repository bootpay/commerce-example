// 공개 레포에 PG secret_key 를 두지 않기 위한 조회 헬퍼.
// client_key 는 공개 값이라 코드에 남기고, secret_key 는 환경변수에서 찾는다.
//   1) BOOTPAY_SECRET_KEY_<DEVELOPMENT|STAGE|PRODUCTION>
//   2) BOOTPAY_CLIENT_KEY 가 같은 키면 BOOTPAY_SECRET_KEY
export function withPgSecret(config, envName, env = {}) {
    const secret = env[`BOOTPAY_SECRET_KEY_${String(envName || 'production').toUpperCase()}`]
        || (env.BOOTPAY_CLIENT_KEY === config.client_key ? env.BOOTPAY_SECRET_KEY : '')
    return { ...config, secret_key: secret || '' }
}
