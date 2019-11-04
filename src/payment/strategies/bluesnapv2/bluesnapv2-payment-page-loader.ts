import { createFormPoster } from '@bigcommerce/form-poster';

import { NotInitializedError, NotInitializedErrorType } from '../../../common/error/errors';
import { PaymentMethodCancelledError } from '../../errors';

import { BlueSnapV2PaymentInitializeOptions } from './bluesnapv2-payment-options';

export default class BlueSnapV2PaymentPageLoader {
    private _blueSnapV2Options?: BlueSnapV2PaymentInitializeOptions;
    private _formPoster = createFormPoster();

    initialize(options?: BlueSnapV2PaymentInitializeOptions): void {
        this._blueSnapV2Options = options;
    }

    loadPaymentPage(frameName: string): Promise<undefined> {
        return new Promise((_, reject) => {
            if (!this._blueSnapV2Options) {
                throw new NotInitializedError(
                    NotInitializedErrorType.PaymentNotInitialized
                );
            }

            const { addFrame } = this._blueSnapV2Options;
            addFrame(undefined, this._createFrame(frameName), () => {
                reject(new PaymentMethodCancelledError());
            });

            window.addEventListener('message', this._receiveMessage, false);
        });
    }

    private _receiveMessage = ({ data: { action, form } }: MessageEvent): void => {
        if (action === 'setExternalCheckout') {
            window.removeEventListener('message', this._receiveMessage, false);

            if (!this._blueSnapV2Options) {
                throw new NotInitializedError(
                    NotInitializedErrorType.PaymentNotInitialized
                );
            }
            const { removeFrame } = this._blueSnapV2Options;
            removeFrame();

            this._formPoster.postForm(form.action, form.values);
        }
    };

    private _createFrame(name: string): HTMLIFrameElement {
        const iframe = document.createElement('iframe');

        iframe.name = name;
        iframe.style.border = '1px solid lightgray';
        iframe.style.height = '60vh';
        iframe.style.width = '100%';

        return iframe;
    }
}
