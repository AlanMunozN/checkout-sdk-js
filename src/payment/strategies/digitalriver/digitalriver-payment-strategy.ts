import { CheckoutStore, InternalCheckoutSelectors } from '../../../checkout';
import {
    InvalidArgumentError,
    MissingDataErrorType,
    NotInitializedError,
    NotInitializedErrorType
} from '../../../common/error/errors';
import MissingDataError from '../../../common/error/errors/missing-data-error';
import { Customer } from '../../../customer';
import { OrderActionCreator, OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import PaymentMethodActionCreator from '../../payment-method-action-creator';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import PaymentStrategy from '../payment-strategy';

import DigitalRiverJS, {
    DigitalRiverDropIn,
    DigitalRiverInitalizeToken,
    OnCancelOrErrorResponse,
    OnSuccessResponse
} from './digitalriver';
import DigitalRiverPaymentInitializeOptions from './digitalriver-payment-initialize-options';
import DigitalRiverScriptLoader from './digitalriver-script-loader';

export default class DigitalRiverPaymentStrategy implements PaymentStrategy {
    private _digitalRiverJS?: DigitalRiverJS;
    private _digitalRiverDropComponent?: DigitalRiverDropIn;
    private _initializeOptions?: PaymentInitializeOptions;
    private _submitFormEvent?: () => void;
    private _LoadSuccessResponse?: OnSuccessResponse;
    private _digitalRiverCheckoutId?: string;

    constructor(
        private _store: CheckoutStore,
        private _digitalRiverScriptLoader: DigitalRiverScriptLoader,
        private _paymentMethodActionCreator: PaymentMethodActionCreator,
        private _orderActionCreator: OrderActionCreator
    ) {}

    async initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        this._initializeOptions = options;

        const state = await this._store.dispatch(this._paymentMethodActionCreator.loadPaymentMethod(this._getInitializeOptions().methodId));
        const paymentMethod = state.paymentMethods.getPaymentMethodOrThrow(this._getInitializeOptions().methodId);

        if (!paymentMethod.clientToken) {
            throw new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
        }

        const clienToken: DigitalRiverInitalizeToken = JSON.parse(paymentMethod.clientToken);
        const billing = state.billingAddress.getBillingAddressOrThrow();
        const customer = this._getCustomerOptions(state.customer.getCustomer());
        this._digitalRiverCheckoutId = clienToken.checkoutId;

        this._submitFormEvent = this._getDigitalRiverInitializeOptions().submitForm;

        const configuration = {
            sessionId: clienToken.sessionId,
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

        this._digitalRiverJS = await this._digitalRiverScriptLoader.load(paymentMethod.initializationData.publicKey, paymentMethod.initializationData.paymentLanguage);
        this._digitalRiverDropComponent = await this._getDigitalRiverJs().createDropin( configuration );

        await this._digitalRiverDropComponent.mount(this._getDigitalRiverInitializeOptions().container);

        return state;
    }

    deinitialize(): Promise<InternalCheckoutSelectors> {

        return Promise.resolve(this._store.getState());
    }

    async execute(orderRequest: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {

        const { payment, ...order } = orderRequest;
        await this._store.dispatch(this._orderActionCreator.submitOrder(order, options));

        if (!payment || !this._LoadSuccessResponse || !this._digitalRiverCheckoutId) {
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
