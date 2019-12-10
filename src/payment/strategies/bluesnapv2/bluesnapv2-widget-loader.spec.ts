import { NotInitializedError } from '../../../common/error/errors';

import BlueSnapV2WidgetLoader from './bluesnapv2-widget-loader';

describe('BlueSnapV2WidgetLoader', () => {
    let widgetLoader: BlueSnapV2WidgetLoader;

    beforeEach(() => {
        widgetLoader = new BlueSnapV2WidgetLoader();
    });

    it('creates an instance of the payment page loader', () => {
        expect(widgetLoader).toBeInstanceOf(BlueSnapV2WidgetLoader);
    });

    it('loads payment page', () => {
        const options = {
            onLoad: jest.fn(),
        };

        widgetLoader.load('iframename', options);

        expect(options.onLoad.mock.calls[0][0]).toBeInstanceOf(HTMLIFrameElement);
        expect(options.onLoad.mock.calls[0][0].name).toBe('iframename');
    });

    it('throws an error if no initialization data was supplied', () =>
        expect(widgetLoader.load('iframename')).rejects.toThrow(NotInitializedError)
    );
});
