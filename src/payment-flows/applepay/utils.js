/* @flow */

import { COUNTRY } from '@paypal/sdk-constants/src';

import { type DetailedOrderInfo } from '../../api';
import type { ApplePayPaymentContact, ApplePayMerchantCapabilities, ApplePayPaymentRequest, ApplePaySupportedNetworks, ApplePayShippingMethod, FundingOption, ShippingAddress, ShippingMethod } from '../types';

type ValidNetworks = {|
    discover : ApplePaySupportedNetworks,
    visa : ApplePaySupportedNetworks,
    mastercard : ApplePaySupportedNetworks,
    amex : ApplePaySupportedNetworks,
    jcb : ApplePaySupportedNetworks,
    chinaunionpay : ApplePaySupportedNetworks
|};

const validNetworks : ValidNetworks = {
    discover:       'discover',
    visa:           'visa',
    mastercard:     'masterCard',
    amex:           'amex',
    jcb:            'jcb',
    chinaunionpay:  'chinaUnionPay'
};

function getSupportedNetworksFromIssuers(issuers : $ReadOnlyArray<string>) : $ReadOnlyArray<ApplePaySupportedNetworks> {
    if (!issuers || (issuers && issuers.length === 0)) {
        return [];
    }

    function validateIssuers(issuer : string) : ?ApplePaySupportedNetworks {
        const network = issuer.toLowerCase().replace(/_/g, '');
        if (Object.keys(validNetworks).indexOf(network) !== -1) {
            const validNetwork : ApplePaySupportedNetworks = validNetworks[network];
            return validNetwork;
        }
    }

    // $FlowFixMe
    const validIssuers : $ReadOnlyArray<ApplePaySupportedNetworks> = issuers.filter(validateIssuers);

    return validIssuers;
}

function getShippingContactFromAddress(shippingAddress : ?ShippingAddress) : ApplePayPaymentContact {
    if (!shippingAddress) {
        return {
            givenName:          '',
            familyName:         '',
            addressLines:       [],
            locality:           '',
            administrativeArea: '',
            postalCode:         '',
            country:            ''
        };
    }

    const { firstName, lastName, line1, line2, city, state, postalCode, country } = shippingAddress;

    return {
        givenName:    firstName,
        familyName:   lastName,
        addressLines: [
            line1,
            line2
        ],
        locality:           city,
        administrativeArea: state,
        postalCode,
        country
    };
}

function getApplePayShippingMethods(shippingMethods : ?$ReadOnlyArray<ShippingMethod>) : $ReadOnlyArray<ApplePayShippingMethod> {
    if (!shippingMethods || shippingMethods.length === 0) {
        return [];
    }

    return shippingMethods.map(method => {
        return {
            amount:     method.amount && method.amount.currencyValue ? method.amount.currencyValue : '',
            detail:     '',
            identifier: method.type,
            label:      method.label
        };
    });
}

function getMerchantCapabilities(supportedNetworks : $ReadOnlyArray<ApplePaySupportedNetworks>, fundingOptions : $ReadOnlyArray<FundingOption>) : $ReadOnlyArray<ApplePayMerchantCapabilities> {
    const merchantCapabilities : Array<ApplePayMerchantCapabilities> = [];
    merchantCapabilities.push('supports3DS');

    if (supportedNetworks && supportedNetworks.indexOf('chinaUnionPay') !== -1) {
        merchantCapabilities.push('supportsEMV');
    }

    if (fundingOptions) {
        fundingOptions.forEach(option => {
            if (!option.fundingInstrument) {
                return;
            }
            
            if (option.fundingInstrument.type === 'CREDIT_CARD') {
                merchantCapabilities.push('supportsCredit');
            }

            if (option.fundingInstrument.type === 'DEBIT_CARD') {
                merchantCapabilities.push('supportsDebit');
            }
        });
    }

    return merchantCapabilities;
}

export function createApplePayRequest(countryCode : $Values<typeof COUNTRY>, order : DetailedOrderInfo) : ApplePayPaymentRequest {
    const {
        allowedCardIssuers,
        cart: {
            amounts: {
                total: {
                    currencyCode,
                    currencyValue
                }
            },
            shippingAddress,
            shippingMethods
        },
        fundingOptions
    } = order.checkoutSession;

    const supportedNetworks = getSupportedNetworksFromIssuers(allowedCardIssuers);
    const shippingContact = getShippingContactFromAddress(shippingAddress);
    const applePayShippingMethods = getApplePayShippingMethods(shippingMethods);
    const merchantCapabilities = getMerchantCapabilities(supportedNetworks, fundingOptions);

    return {
        countryCode,
        currencyCode,
        merchantCapabilities,
        shippingContact,
        shippingMethods:              applePayShippingMethods,
        supportedNetworks,
        requiredBillingContactFields: [
            'postalAddress',
            'name',
            'phone'
        ],
        requiredShippingContactFields: [
            'postalAddress',
            'name',
            'phone',
            'email'
        ],
        total:           {
            amount: currencyValue,
            label:  '',
            type:   'final'
        }
    };
}

export function getMerchantStoreName(order : DetailedOrderInfo) : string {
    return order && order.checkoutSession && order.checkoutSession.merchant && order.checkoutSession.merchant.name;
}