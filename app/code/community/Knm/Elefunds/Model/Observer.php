<?php

/**
 * elefunds Shopware Module
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
class Knm_Elefunds_Model_Observer
{

    /**
     * @var Knm_Elefunds_Helper_Data
     */
    protected $helper;

    protected $syncManager;

    public function __construct() {
        $this->helper = Mage::helper('elefunds');
        $this->syncManager = new Knm_Elefunds_Manager_SyncManager($this->helper->getConfiguredFacade());
    }

    /**
     * Dispatched when the order is saved.
     *
     * Manipulates the quote with an elefunds virtual product.
     *
     * @param Varien_Event_Observer $observer
     * @return void
     */
    public function onSaveOrder(Varien_Event_Observer $observer)
    {

        $request = Mage::app()->getRequest();

        /** @var Mage_Checkout_Model_Session $checkoutSession  */
        $checkoutSession = Mage::getSingleton('checkout/session');
        $quote = $checkoutSession->getQuote();

        $path = 'elefunds/config/active';
        $isActive = Mage::getStoreConfig($path);

        if (!$isActive || !$request->has('elefunds_checkbox') || $request->getPost('elefunds_checkbox') !== 'on') {
            return;
        }
        
        $receivers = $request->getPost('elefunds_receiver');
        $donationAmountCents= (int)$request->getPost('elefunds_donation_cent');

        if ($receivers === NULL || $donationAmountCents === 0) {
            return;
        }

        /** @var Mage_Sales_Model_Quote_Item $elefundsProduct  */
        $elefundsProduct = $this->helper->getVirtualProduct();

        if ($elefundsProduct === NULL) {
            Mage::log('Elefunds object not found on store!!', NULL, 'elefunds.log');
            return;
        }
        
        if ($quote->hasProductId($elefundsProduct->getId())) {
            return;
        }

        $elefundsProduct->setPrice($donationAmountCents/100);
        $elefundsProduct->setBasePrice($donationAmountCents/100);
        $quote->addProduct($elefundsProduct);
    }

    /**
     * Dispatched when the order is finished.
     *
     * @param Varien_Event_Observer $observer
     * @return void
     */
    public function onOrderFinished(Varien_Event_Observer $observer)
    {
        $request = Mage::app()->getRequest();
        /* @var $order Mage_Sales_Model_Order */
        $order = $observer->getEvent()->getOrder();

        /** @var Mage_Sales_Model_Quote $quote  */
        $quote = $observer->getEvent()->getQuote();

        /** @var Mage_Sales_Model_Quote_Item $elefundsProduct  */
        $elefundsProduct = $this->helper->getVirtualProduct();

        if ($elefundsProduct === NULL || !$quote->hasProductId($elefundsProduct->getId())) {
            return;
        }

        /** @var Knm_Elefunds_Model_Mysql4_Donation_Collection $donationCollection  */
        $donationCollection = Mage::getModel('elefunds/donation')->getCollection();

        $params = $request->getParams();

        if (isset($params['elefunds_checkbox']) && isset($params['elefunds_donation_cent']) && ctype_digit($params['elefunds_donation_cent'])) {
            /** +++ Input Validation +++ */

            $roundup  = (int)$params['elefunds_donation_cent'];

            // We have to cast the amount to string and then to int, as the session does not care about
            // floating point precision.
            $grandTotal = (int)$grandTotal = $order->getTotalDue() * 100;

            $receiverIds = array_map(function($x) { return (int)$x; }, $params['elefunds_receiver']);

            if (isset($params['elefunds_suggested_round_up_cent']) && ctype_digit($params['elefunds_suggested_round_up_cent'])) {
                $suggestedRoundUp = (int)$params['elefunds_suggested_round_up_cent'];
            } else {
                $suggestedRoundUp = 0;
            }

            $billingAddress = $order->getBillingAddress();

            if (isset($params['elefunds_receipt_input'])) {
                $user = array(
                    'firstName'      =>  $billingAddress->getFirstname() ? $billingAddress->getFirstname() : '',
                    'lastName'       =>  $billingAddress->getLastname() ? $billingAddress->getLastname() : $order->getCustomerName(),
                    'email'          =>  $billingAddress->getEmail(),
                    'streetAddress'  =>  $billingAddress->getStreet(),
                    'zip'            =>  (int)$billingAddress->getPostcode(),
                    'city'           =>   $billingAddress->getCity()
                );
            } else {
                $user = array();
            }
            /** ^^^ Input Validation ^^^ */
            $donationCollection->addDonation(
                $order->getIncrementId(),
                $roundup,
                $grandTotal,
                $receiverIds,
                $availableReceiverIds, // @todo retrieve from database
                $user,
                $billingAddress->getCountryId()
            );

            $this->syncManager->syncDonations();

        }
    }
    
    public function captureCancelDonation($observer)
    {
        $order = $observer->getEvent()->getOrder();

        /** @var Knm_Elefunds_Model_Donation $donation  */
        $donation = Mage::getModel('elefunds/donation');
        $donation->loadByAttribute('order_id', $order->getId());

        if ($donation !== NULL) {
            $donation->setState(Knm_Elefunds_Model_Donation::SCHEDULED_FOR_CANCELLATION);
            $this->syncManager->syncDonations();
        }
        
/** @todo What's going on here?
        $order->addRelatedObject($donation);
        Mage::register('donation_item', $donationItem);
        $order->getResource()->addCommitCallback(array($this , 'sendCancelDonation'));
 */
    }

    /*
     * name: limitPayments
     * 
     * Based on backend settings (payment methods), limits the display of elefunds banner in checkout review
     * 
     * @param      Varien_Event_Observer $observer
     * @author Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
     */
     public function limitPayments($observer) {
         //Knm_Elefunds_Block_Checkout_Banner
         $block = $observer->getEvent()->getObject();
         $mcode = Mage::getSingleton('checkout/session')->getQuote()->getPayment()->getMethodInstance()->getCode();
         
         $path='elefunds/config/authorized_payment_methods';
         $storeId =Mage::app()->getStore()->getId();
         $authorizedMethods=Mage::getStoreConfig($path, $storeId);
        if (empty($authorizedMethods)) {
            $authorizedMethods=array();
        } else {
            $authorizedMethods=explode(',',$authorizedMethods);
        }

         
         if (!in_array($mcode, $authorizedMethods))
         {
             $block->canShowBanner(false);
         }
    }
    
    
    public function noDonationRules($observer){
        $quoteItem = $observer->getQuoteItem();
        $product = $observer->getProduct();
        $helper = Mage::helper('elefunds');
        $donationSku = $helper->getVirtualProductSku();
        
        if ($product->getSku()==$donationSku) {
            $quoteItem->setNoDiscount(1);
        }
    }
}

