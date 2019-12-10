import { NotInitializedError, NotInitializedErrorType } from '../../../common/error/errors';
import { PaymentMethodCancelledError } from '../../errors';

import { BlueSnapV2StyleProps } from './bluesnapv2';
import { BlueSnapV2PaymentInitializeOptions } from './bluesnapv2-payment-options';

export default class BlueSnapV2WidgetLoader {
    load(frameName: string, options?: BlueSnapV2PaymentInitializeOptions) {
        return new Promise((_, reject) => {
            if (!options) {
                throw new NotInitializedError(
                    NotInitializedErrorType.PaymentNotInitialized
                );
            }

            const { onLoad, style } = options;
            onLoad(this._createFrame(frameName, style), () => {
                reject(new PaymentMethodCancelledError());
            });
        });
    }

    private _createFrame(name: string, style?: BlueSnapV2StyleProps): HTMLIFrameElement {
        const iframe = document.createElement('iframe');

        iframe.name = name;

        if (style) {
            const { border, height, width } = style;

            iframe.style.border = border as string;
            iframe.style.height = height as string;
            iframe.style.width = width as string;
        }

        return iframe;
    }
}
