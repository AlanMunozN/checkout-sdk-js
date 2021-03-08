[@bigcommerce/checkout-sdk](../README.md) › [DigitalRiverPaymentInitializeOptions](digitalriverpaymentinitializeoptions.md)

# Interface: DigitalRiverPaymentInitializeOptions

## Hierarchy

* **DigitalRiverPaymentInitializeOptions**

## Index

### Properties

* [configuration](digitalriverpaymentinitializeoptions.md#configuration)
* [containerId](digitalriverpaymentinitializeoptions.md#containerid)

### Methods

* [onError](digitalriverpaymentinitializeoptions.md#optional-onerror)
* [onRenderButton](digitalriverpaymentinitializeoptions.md#optional-onrenderbutton)
* [submitForm](digitalriverpaymentinitializeoptions.md#submitform)

## Properties

###  configuration

• **configuration**: *[OptionsResponse](optionsresponse.md)*

Create a Configuration object for Drop-in that contains both required and optional values.
https://docs.digitalriver.com/digital-river-api/payment-integrations-1/drop-in/drop-in-integration-guide#step-5-configure-hydrate

___

###  containerId

• **containerId**: *string*

The ID of a container which the Digital River drop in component should be mounted

## Methods

### `Optional` onError

▸ **onError**(`error`: [Error](amazonpaywidgeterror.md#error)): *void*

Callback for displaying error popup. This callback requires error object as parameter and is called in case of  Drop-in error

**Parameters:**

Name | Type |
------ | ------ |
`error` | [Error](amazonpaywidgeterror.md#error) |

**Returns:** *void*

___

### `Optional` onRenderButton

▸ **onRenderButton**(): *void*

Callback right after render Digital River Drop In component that gets called when
Digital River is eligible. This callback can be used to hide the standard submit button.

**Returns:** *void*

___

###  submitForm

▸ **submitForm**(): *void*

Callback for submitting payment form that gets called
when buyer pay with DigitalRiver.

**Returns:** *void*
