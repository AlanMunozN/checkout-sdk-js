import { PaymentInitializeOptions } from '../../payment-request-options';

import DigitalRiverJS from './digitalriver';

export function getDigitalRiverJs(): DigitalRiverJS {
    return {
        createDropin: jest.fn(() => {
            return {
                mount: jest.fn(),
            };
        }),
    };
}

export function getInitializeOptions(): PaymentInitializeOptions {
    return {
        digitalriver: {
            container: 'drop-in',
            configuration: {
                button: {
                    type: 'submitOrder',
                },
                flow: 'checkout',
                showComplianceSection: true,
                showSavePaymentAgreement: false,
                showTermsOfSaleDisclosure: true,
                usage: 'unscheduled',
            },
            onError: jest.fn(),
            onRenderButton: jest.fn(),
            submitForm: jest.fn(),
        },
        gatewayId: '',
        methodId: 'digitalriver',
    };
}
