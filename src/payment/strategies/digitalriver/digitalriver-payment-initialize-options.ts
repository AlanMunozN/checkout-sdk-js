import { OptionsResponse } from './digitalriver';

export default interface DigitalRiverPaymentInitializeOptions {
    /**
     * The ID of a container which the payment widget should insert into.
     */
    container: string;
    configuration: OptionsResponse;

    /**
     * A callback for submitting payment form that gets called
     * when buyer approved DigitalRiver.
     */
    submitForm(): void;

    /**
     * A callback right before render Smart Payment Button that gets called when
     * Smart Payment Button is eligible. This callback can be used to hide the standard submit button.
     */
    onRenderButton?(): void;

    /**
     * A callback for displaying error popup. This callback requires error object as parameter.
     */
    onError?(error: Error): void;
}
