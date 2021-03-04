import { OptionsResponse } from './digitalriver';

export default interface DigitalRiverPaymentInitializeOptions {
    /**
     * The ID of a container which the Digital River drop in component should be mounted
     */
    containerId: string;

    /**
     * Create a Configuration object for Drop-in that contains both required and optional values.
     * https://docs.digitalriver.com/digital-river-api/payment-integrations-1/drop-in/drop-in-integration-guide#step-5-configure-hydrate
     */
    configuration: OptionsResponse;

    /**
     * Callback for submitting payment form that gets called
     * when buyer pay with DigitalRiver.
     */
    submitForm(): void;

    /**
     * Callback right after render Digital River Drop In component that gets called when
     * Digital River is eligible. This callback can be used to hide the standard submit button.
     */
    onRenderButton?(): void;

    /**
     * Callback for displaying error popup. This callback requires error object as parameter and is called in case of  Drop-in error
     */
    onError?(error: Error): void;
}
