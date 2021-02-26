import { CheckoutStore, InternalCheckoutSelectors } from '../../../checkout';
import { InvalidArgumentError, NotInitializedError, NotInitializedErrorType } from '../../../common/error/errors';
import { Customer } from '../../../customer';
import { OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import PaymentStrategy from '../payment-strategy';

import DigitalRiverJS, { DigitalRiverDropIn, OnCancelOrErrorResponse, OnSuccessResponse } from './digitalriver';
import DigitalRiverPaymentInitializeOptions from './digitalriver-payment-initialize-options';
import DigitalRiverScriptLoader from './digitalriver-script-loader';

export default class DigitalRiverPaymentStrategy implements PaymentStrategy {
    private _digitalRiverJS?: DigitalRiverJS;
    private _digitalRiverDropComponent?: DigitalRiverDropIn;
    private _initializeOptions?: PaymentInitializeOptions;
    private _submitFormEvent?: () => void;
    private _LoadSuccessResponse?: OnSuccessResponse;

    constructor(
        private _store: CheckoutStore,
        private _digitalRiverScriptLoader: DigitalRiverScriptLoader
    ) {}

    async initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        this._initializeOptions = options;

        const state = this._store.getState();
        const sessionId = 'd4b2617a-68d4-4040-bf94-257ee9ed16e3';
        const billing = state.billingAddress.getBillingAddressOrThrow();
        const customer = this._getCustomerOptions(state.customer.getCustomer());

        this._submitFormEvent = this._getDigitalRiverInitializeOptions().submitForm;

        const configuration = {
            sessionId,
            options: { ...this._getDigitalRiverInitializeOptions().configuration },
            billingAddress: {
                firstName: billing.firstName,
                lastName: billing.lastName,
                email: billing.email ? billing.email : customer.email,
                phoneNumber: billing.phone,
                address: {
                    line1: billing.address1,
                    line2: billing.address2,
                    city: billing.city,
                    state: billing.stateOrProvinceCode,
                    postalCode: billing.postalCode,
                    country: billing.countryCode,
                },
            },
            onSuccess: (data?: OnSuccessResponse) => {
                this._onSuccessResponse(data);
            },

            onError: (error: OnCancelOrErrorResponse) => {
                this._getDigitalRiverInitializeOptions().onError?.(new Error(this._getErrorMessage(error)));
            },
        };

        this._digitalRiverJS = await this._digitalRiverScriptLoader.load('pk_test_8c539de00bf3492494c36b4673ab4bf5', 'en-US');
        this._digitalRiverDropComponent = await this._getDigitalRiverJs().createDropin( configuration );

        await this._digitalRiverDropComponent.mount(this._getDigitalRiverInitializeOptions().container);

        return state;
    }

    deinitialize(): Promise<InternalCheckoutSelectors> {

        return Promise.resolve(this._store.getState());
    }

    execute(payload: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        if (!payload.payment || options || this._LoadSuccessResponse) {
            throw new InvalidArgumentError('Unable to proceed because payload payment argument is not provided.');
        }

        return Promise.resolve(this._store.getState());
    }

    finalize(): Promise<InternalCheckoutSelectors> {

        return Promise.reject(new OrderFinalizationNotRequiredError());
    }

    private _getDigitalRiverJs(): DigitalRiverJS {
        if (!this._digitalRiverJS) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        return this._digitalRiverJS;
    }

    private _getErrorMessage(error: OnCancelOrErrorResponse): string {
        const { errors } = error;

        return errors.map(e => 'code: ' + e.code + ' message: ' + e.message).join('\n');
    }

    private _onSuccessResponse(data?: OnSuccessResponse): void {

        if (!data || !this._submitFormEvent) {
            throw new InvalidArgumentError('Unable to initialize payment because success argument is not provided.');
        }

        this._LoadSuccessResponse = data.source.browserInfo ? {
            source: {
                id: data.source.id,
                reusable: data.source.reusable,
                browserInfo: {
                    browserIp: data.source.browserInfo.browserIp,
                },
            },
            readyForStorage: data.readyForStorage,
        } : {
            source: {
                id: data.source.id,
                reusable: data.source.reusable,
            },
            readyForStorage: data.readyForStorage,
        } ;

        this._submitFormEvent();
    }

    private _getInitializeOptions(): PaymentInitializeOptions {
        if (!this._initializeOptions) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        return this._initializeOptions;
    }

    private _getDigitalRiverInitializeOptions(): DigitalRiverPaymentInitializeOptions {
        const { digitalriver } = this._getInitializeOptions();

        if (!digitalriver) {
            throw new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
        }

        return digitalriver;
    }

    private _getCustomerOptions(customer?: Customer): Customer {

        if (!customer) {
            throw new NotInitializedError(NotInitializedErrorType.CustomerNotInitialized);
        }

        return customer;
    }
}
