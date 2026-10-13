/**
 * Bootpay Commerce Example - CDN 설정 파일
 *
 * 사용 방법:
 * 1. 이 파일을 복사하여 config.js로 저장하세요: cp config.example.js config.js
 * 2. config.js의 값을 실제 Bootpay 키로 변경하세요.
 * 3. config.js는 .gitignore에 포함되어 있어 커밋되지 않습니다.
 *
 * 키 발급:
 * - https://admin.bootpay.co.kr 에서 프로젝트 생성 후 발급받을 수 있습니다.
 * - Application ID: 프로젝트 > 설정 > 앱정보
 * - Client Key: 프로젝트 > 설정 > 앱정보
 * - Product ID: 상품에서 생성 후 확인
 */

window.BOOTPAY_CONFIG = {
    // ========================================
    // Widget 예제 설정
    // ========================================
    widget: {
        development: {
            client_key: 'YOUR_DEV_CLIENT_KEY'  // 테스트용 Client Key
        },
        stage: {
            client_key: 'YOUR_STAGE_CLIENT_KEY'  // 스테이징 Client Key
        },
        production: {
            client_key: 'YOUR_PROD_CLIENT_KEY'  // 실서비스 Client Key
        }
    },

    // ========================================
    // Plan (정기결제) 예제 설정
    // ========================================
    plan: {
        development: {
            client_key: 'YOUR_DEV_CLIENT_KEY',  // 테스트용 Client Key
            plans: {
                starter: {
                    monthly_product_id: 'YOUR_STARTER_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_STARTER_YEARLY_PRODUCT_ID'
                },
                pro: {
                    monthly_product_id: 'YOUR_PRO_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_PRO_YEARLY_PRODUCT_ID'
                },
                enterprise: {
                    monthly_product_id: 'YOUR_ENTERPRISE_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_ENTERPRISE_YEARLY_PRODUCT_ID'
                }
            }
        },
        stage: {
            client_key: 'YOUR_STAGE_CLIENT_KEY',
            plans: {
                starter: {
                    monthly_product_id: 'YOUR_STARTER_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_STARTER_YEARLY_PRODUCT_ID'
                },
                pro: {
                    monthly_product_id: 'YOUR_PRO_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_PRO_YEARLY_PRODUCT_ID'
                },
                enterprise: {
                    monthly_product_id: 'YOUR_ENTERPRISE_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_ENTERPRISE_YEARLY_PRODUCT_ID'
                }
            }
        },
        production: {
            client_key: 'YOUR_PROD_CLIENT_KEY',
            plans: {
                starter: {
                    monthly_product_id: 'YOUR_STARTER_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_STARTER_YEARLY_PRODUCT_ID'
                },
                pro: {
                    monthly_product_id: 'YOUR_PRO_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_PRO_YEARLY_PRODUCT_ID'
                },
                enterprise: {
                    monthly_product_id: 'YOUR_ENTERPRISE_MONTHLY_PRODUCT_ID',
                    yearly_product_id: 'YOUR_ENTERPRISE_YEARLY_PRODUCT_ID'
                }
            }
        }
    },

    // ========================================
    // Integrated (통합결제) 예제 설정
    // ========================================
    integrated: {
        development: {
            client_key: 'YOUR_DEV_CLIENT_KEY'
        },
        stage: {
            client_key: 'YOUR_STAGE_CLIENT_KEY'
        },
        production: {
            client_key: 'YOUR_PROD_CLIENT_KEY'
        }
    },

    // ========================================
    // Subscription (자동결제/정기결제) 예제 설정
    // requestSubscription 은 client_key 사용 (통합결제와 동일)
    // ========================================
    subscription: {
        development: {
            client_key: 'YOUR_DEV_CLIENT_KEY'
        },
        stage: {
            client_key: 'YOUR_STAGE_CLIENT_KEY'
        },
        production: {
            client_key: 'YOUR_PROD_CLIENT_KEY'
        }
    },

    // ========================================
    // Payment Link (결제링크) 예제 설정
    // ========================================
    paymentLink: {
        development: {
            products: {
                basic: { product_id: 'YOUR_BASIC_PRODUCT_ID' },
                pro: { product_id: 'YOUR_PRO_PRODUCT_ID' },
                enterprise: { product_id: 'YOUR_ENTERPRISE_PRODUCT_ID' }
            }
        },
        stage: {
            products: {
                basic: { product_id: 'YOUR_BASIC_PRODUCT_ID' },
                pro: { product_id: 'YOUR_PRO_PRODUCT_ID' },
                enterprise: { product_id: 'YOUR_ENTERPRISE_PRODUCT_ID' }
            }
        },
        production: {
            products: {
                basic: { product_id: 'YOUR_BASIC_PRODUCT_ID' },
                pro: { product_id: 'YOUR_PRO_PRODUCT_ID' },
                enterprise: { product_id: 'YOUR_ENTERPRISE_PRODUCT_ID' }
            }
        }
    }
};
