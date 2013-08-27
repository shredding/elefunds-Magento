<?php

/**
 * elefunds Magento Module
 *
 * Copyright (c) 2012, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

use Lfnds\Template\Shop\Helper\RequestHelper;

/**
 * Watches for events that are interacting with the elefunds module.
 *
 * @package    elefunds Magento Module
 * @subpackage Model
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>, Christian Peters <christian@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Lfnds_Donation_Model_Observer
{

    /**
     * @var Lfnds_Donation_Helper_Data
     */
    protected $helper;

    public function __construct() {
        $this->helper = Mage::helper('lfnds_donation');
    }

    /**
     * Adds the virtual product to the quote, so it's in included in the
     * processed order on save order after.
     *
     * @param Varien_Event_Observer $observer
     * @return void
     */
    public function onPreDispatchSaveOrder(Varien_Event_Observer $observer) {

        /** @var RequestHelper $requestHelper  */
        $requestHelper = $this->helper->getRequestHelper();
        if ($requestHelper->isActiveAndValid()) {

            /** @var Mage_Checkout_Model_Session $checkoutSession  */
            $checkoutSession = Mage::getSingleton('checkout/session');
            $quote = $checkoutSession->getQuote();

            /** @var Mage_Sales_Model_Quote_Item $elefundsProduct  */
            $elefundsProduct = $this->helper->getVirtualProduct();

            if ($elefundsProduct === NULL) {
                Mage::log('Elefunds object not found on store!');
                return;
            }

            if ($quote->hasProductId($elefundsProduct->getId())) {
                return;
            }

            $roundUpAsFloat = $requestHelper->getRoundUpAsFloatedString();
            $elefundsProduct->setPrice($roundUpAsFloat);
            $elefundsProduct->setBasePrice($roundUpAsFloat);
            $quote->addProduct($elefundsProduct);
        }
    }

    /**
     * Dispatched after the order is saved.
     *
     * Manipulates the quote with an elefunds virtual product.
     *
     * @param Varien_Event_Observer $observer
     * @return void
     */
    public function onSaveOrderAfter(Varien_Event_Observer $observer) {

        /** @var RequestHelper $requestHelper  */
        $requestHelper = $this->helper->getRequestHelper();

        if($requestHelper->isActiveAndValid()) {

            /* @var $order Mage_Sales_Model_Order */
            $order = $observer->getEvent()->getOrder();

            if ($requestHelper->isDonationReceiptRequested()) {
                $billingAddress = $order->getBillingAddress();
                $streets = $billingAddress->getStreet(); // 5.3 compliant lazy array access
                $user = array(
                    'firstName'      =>  $billingAddress->getFirstname() ? $billingAddress->getFirstname() : '',
                    'lastName'       =>  $billingAddress->getLastname() ? $billingAddress->getLastname() : $order->getCustomerName(),
                    'email'          =>  $billingAddress->getEmail(),
                    'streetAddress'  =>  $streets[0],
                    'zip'            =>  (int)$billingAddress->getPostcode(),
                    'city'           =>   $billingAddress->getCity()
                );
            } else {
                $user = array();
            }

            /** @var Lfnds_Donation_Model_Mysql4_Donation_Collection $donationCollection  */
            $donationCollection = Mage::getModel('lfnds_donation/donation')->getCollection();
            $donationCollection->addDonation(
                $order->getIncrementId(),
                $requestHelper->getRoundUp(),
                $order->getTotalDue() * 100,
                $requestHelper->getReceiverIds(),
                $requestHelper->getAvailableReceiverIds(),
                $user,
                $order->getBillingAddress()->getCountryId(),
                $requestHelper->getSuggestedRoundUp(),
                Lfnds_Donation_Model_Donation::NEW_ORDER
            );
        }
    }

    /**
     * Dispatched when the order is finished.
     *
     * @param Varien_Event_Observer $observer
     * @return void
     */
    public function onOrderFinished(Varien_Event_Observer $observer)
    {
        $orderIds = $observer->getEvent()->getOrderIds();

        $orderId = 0;
        if (is_array($orderIds) && !empty($orderIds)) {
            $orderId = (int)$orderIds[0];
        }

        /* @var $order Mage_Sales_Model_Order */
        $order = Mage::getModel('sales/order')->load($orderId);

        /** @var Mage_Sales_Model_Quote_Item $elefundsProduct  */
        $elefundsProduct = $this->helper->getVirtualProduct();

        if ($elefundsProduct === NULL) {
            Mage::log('Elefunds object not found on store!');
            return;
        }

        if ($order->getItemByQuoteItemId($elefundsProduct->getQuoteId()) !== NULL) {

            $donation = Mage::getModel('lfnds_donation/donation');
            $donation->loadByAttribute('foreign_id', $order->getIncrementId());

            if ($donation !== NULL && $donation->getId()) {
                $donation->setState(Lfnds_Donation_Model_Donation::SCHEDULED_FOR_ADDING);
                $donation->save();
            }

            $this->helper->getSyncManager()->syncDonations();
        }
    }

    /**
     * Whenever an order is saved, we check if it contains a donation and if the status change is of
     * interest for the API. If so, we invoke the sync process.
     *
     * @param Varien_Event_Observer $observer
     * @return void
     */
    public function onOrderSaved(Varien_Event_Observer $observer)
    {
        /* @var $order Mage_Sales_Model_Order */
        $order = $observer->getEvent()->getOrder();

        $newState = $order->getData('state');
        $oldState = $order->getOrigData('state');

        if ($newState === NULL || $oldState === NULL) {
            return;
        }

        /** @var Lfnds_Donation_Model_Donation $donation  */
        $donation = Mage::getModel('lfnds_donation/donation');
        $donation->loadByAttribute('foreign_id', $order->getIncrementId());

        if ($donation !== NULL) {

            // Some donations change the state of the donation, so we have to check if the donation is valid.
            $isValid = !in_array(NULL, array($donation->getForeignId(), $donation->getAmount(), $donation->getReceiverIds()));
            if (!$isValid) {
                return;
            }

            $stateHasChanged = $newState !== $oldState;

            if ($stateHasChanged) {

                // We have to map the magento states to API states ...
                $statesToBeMappedToAddingState = array(
                    Mage_Sales_Model_Order::STATE_PENDING_PAYMENT,
                    Mage_Sales_Model_Order::STATE_PROCESSING,
                    Mage_Sales_Model_Order::STATE_PAYMENT_REVIEW
                );

                $statesToBeMappedToCancelledState = array(
                    Mage_Sales_Model_Order::STATE_CANCELED
                );

                $statesToBeMappedToCompletionState = array(
                    Mage_Sales_Model_Order::STATE_CLOSED,
                    Mage_Sales_Model_Order::STATE_COMPLETE
                );

                $stateToBySyncedToTheApi = -1;

                if (in_array($newState, $statesToBeMappedToAddingState)) {
                    $stateToBySyncedToTheApi = Lfnds_Donation_Model_Donation::SCHEDULED_FOR_ADDING;
                }
                if (in_array($newState, $statesToBeMappedToCancelledState)) {
                    $stateToBySyncedToTheApi = Lfnds_Donation_Model_Donation::SCHEDULED_FOR_CANCELLATION;
                }
                if (in_array($newState, $statesToBeMappedToCompletionState)) {
                    $stateToBySyncedToTheApi = Lfnds_Donation_Model_Donation::SCHEDULED_FOR_COMPLETION;
                }

                    if ($stateToBySyncedToTheApi > Lfnds_Donation_Model_Donation::NEW_ORDER) {
                    if ($donation->getState() !== $stateToBySyncedToTheApi) {
                        $donation->setState($stateToBySyncedToTheApi);
                        $donation->save();
                        $this->helper->getSyncManager()->syncDonations();
                    }
                }
            }
        }
    }

    /**
     * Removes the Donation from cloned (reordered or edited orders) in the backend.
     *
     * @param Varien_Event_Observer $observer
     */
    public function removeDonationFromClonedOrderInBackend(Varien_Event_Observer $observer) {

        /* @var $order Mage_Sales_Model_Order */
        $order = $observer->getEvent()->getOrder();

        /* @var Mage_Sales_Model_Quote $quote */
        $quote = $observer->getEvent()->getQuote();

        $elefundsItem = NULL;
        /** @var Mage_Sales_Model_Order_Item $item  */
        foreach ($order->getAllItems() as $item) {
            if (strtolower($item->getSku()) === Lfnds_Donation_Model_Donation::ELEFUNDS_VIRTUAL_PRODUCT_SKU) {
                $elefundsItem = $item;
                break;
            }
        }

        if ($elefundsItem !== NULL) {
            $allItems = $quote->getAllItems();
            // Since $quote->removeItem() does not work for virtual products,
            // we have to remove and re-add all items.
            // @todo: removeAllItems was implemented in 1.6, we have reimplemented here for 1.5
            // @todo: can be exchanged with $quote->removeAllItems() if we no longer support 1.5
            foreach ($quote->getItemsCollection() as $itemId => $item) {
                if (is_null($item->getId())) {
                    $quote->getItemsCollection()->removeItemByKey($itemId);
                } else {
                    $item->isDeleted(TRUE);
                }
            }


            /** @var Mage_Sales_Model_Quote_Item $item  */
            foreach ($allItems as $item) {
                if (strtolower($item->getSku()) !== Lfnds_Donation_Model_Donation::ELEFUNDS_VIRTUAL_PRODUCT_SKU) {
                    $quote->addItem($item);
                }
            }
            $quote->save();
        }
    }


    /**
     * @param Varien_Event_Observer $observer
     */
    public function limitPayments(Varien_Event_Observer $observer) {
        /**  @var Lfnds_Donation_Block_Checkout_Banner $block */
        $block = $observer->getEvent()->getObject();

        $paymentCode = NULL;
        try {
            $paymentCode = Mage::getSingleton('checkout/session')->getQuote()
                ->getPayment()
                ->getMethodInstance()
                ->getCode();
        } catch (Exception $exception) {
            // This exception is thrown, when the merchant uses some kind of one step checkout
            // (where no payment has yet been set).
            // If so, check if you have enabled the one step checkout in the settings.
            // If it's a one step checkout that we do not support,
            // we silently bypass the module, as the shop would crash otherwise.
            Mage::log('We could not get a default payment and are deactivating the banner.');
        }

        $excludedMethods = $this->helper->getExcludedPaymentMethods();
        if (in_array($paymentCode, $excludedMethods)) {
            $block->deactivateBanner();
        }
    }

    /**
     * @param Varien_Event_Observer $observer
     */
    public function excludeDonationFromDiscount(Varien_Event_Observer $observer) {
        $quoteItem = $observer->getQuoteItem();
        $product = $observer->getProduct();
        if (strtolower($product->getSku()) === Lfnds_Donation_Model_Donation::ELEFUNDS_VIRTUAL_PRODUCT_SKU) {
            $quoteItem->setNoDiscount(TRUE);
            $quoteItem->setDiscountCalculationPrice(0);
        }
    }
    
}