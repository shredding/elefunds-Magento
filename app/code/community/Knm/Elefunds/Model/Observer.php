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

    public function __construct() {
        $this->helper = Mage::helper('elefunds');
    }

    /**
     * Dispatched when the order is saved.
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

        /** @todo check if this is needed or even exists! */
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


        /** @todo What is the event that is fired here=? */

        /* @var $order Mage_Sales_Model_Order */
        $order = $observer->getEvent()->getOrder();

        /** @var Mage_Sales_Model_Quote $quote  */
        $quote = $observer->getEvent()->getQuote();

        /** @var Mage_Sales_Model_Quote_Item $elefundsProduct  */
        $elefundsProduct = $this->helper->getVirtualProduct();

        if ($elefundsProduct === NULL || !$quote->hasProductId($elefundsProduct->getId())) {
            return;
        }


        $storeId = Mage::app()->getStore()->getId();
        $captureItem = Mage::getModel('elefunds/donation');
        $captureItem->loadByAttribute('order_id', $id);
        if (!$captureItem->getId()) {
            $captureItem = Mage::getModel('elefunds/donation');
        }
        $captureItem->setOrderId($id) //For update.
                    ->setStoreId($storeId)
                    ->setAmount($request->getParam('elefunds_donation_cent', 0)/100)
                    ->setSuggestedAmount($request->getParam('elefunds_suggested_round_up_cent', 0)/100)
                    ->setStatus(Knm_Elefunds_Model_Donation::STATE_NEW)
                    ->setReceivers(serialize($request->getParam('elefunds_receiver', array())))
                    ->setCreatedAt(date("Y-m-d H:i:s"))
                    ->setUpdatedAt(date("Y-m-d H:i:s"));
        $receipt=$request->getParam('elefunds_receipt_input');
        if (!empty($receipt)) {
            $captureItem->setReceipt(true);
        }
        
        try {            
            $captureItem->save(); //TODO: Try catch and management. 
        } catch (Exception $e) {
            Mage::log("ELEFUNDS: The data related to donation on order {$id} could not be saved", null, '2016.log');
        }
    }
    
    public function sendDonation($observer)
    {
        $helper=Mage::helper('elefunds');
        //NOTE:Depending on the Event the Order should be adquired.!
        $orderId = $observer->getEvent()->getOrderIds();
        if (is_array($orderId) && !empty($orderId)) {
        	$orderId=$orderId[0];
        }
        $order=Mage::getModel('sales/order')->load($orderId);
        //End Note.
        $donationItem = Mage::getModel('elefunds/donation');
        $donationItem->loadByAttribute('order_id', $orderId);
        $logItem = Mage::getModel('elefunds/logs');
        
        if (!$donationItem->getId()) {
            //Donation data was not saved? TODO: log? ... return.
            return;
        }
        $donationStatus=$donationItem->getStatus();
        $oldUpdatedAt=$donationItem->getUpdatedAt();
        
        try {
            $time = new DateTime(); //date("Y-m-d H:i:s");
            $facade = $helper->getElefundsFacade();

        	$receiversArray = unserialize($donationItem->getReceivers());
        	$receiversArray =  array_map(function($x) { return (int)$x;}, $receiversArray); //TODO: Sdk more flexible
            $donation = $facade->createDonation()
                        ->setForeignId($order->getIncrementId())
                        ->setAmount((int)($donationItem->getAmount()*100))
                        ->setSuggestedAmount((int)($donationItem->getSuggestedAmount()*100))
                        ->setGrandTotal((int)($order->getGrandTotal()*100))
                        ->setReceiverIds($receiversArray)
                        ->setTime($time);
            if ($donationItem->getReceipt()) 
            {
                $billingAddress = $order->getBillingAddress();
                $firstname = $billingAddress->getFirstname()? $billingAddress->getFirstname() : '';
                $lastname = $billingAddress->getLastname()? $billingAddress->getLastname() : $order->getCustomerName();
                $email = $billingAddress->getEmail();
                $streetAddressSource = $billingAddress->getStreet();
                $streetAddress = is_array($streetAddressSource) ? implode("\n",$streetAddressSource) : $streetAddressSource ;
                $zip = (int)$billingAddress->getPostcode();
                $city = $billingAddress->getCity();
                $countryCode = $billingAddress->getCountryId();

                $donation->setDonator($email, $firstname, $lastname, $streetAddress, $zip, $city, $countryCode);
            }
            //Available receivers will not be sent for the time being in
            //accordance with chat of today 29.01.2013 with christian.
            
            $response = $facade->addDonations(array($donation));
            
            $donationAsArray = $donation->toArray();
                       
            $logItem->setRequest(serialize($donationAsArray))
                    ->setResponse($response)
                    ->setCreatedAt($time->format("Y-m-d H:i:s"));
            $logItem->save();
            
            $donationItem->setStatus(Knm_Elefunds_Model_Donation::STATUS_SENT);
            $donationItem->setUpdatedAt($time->format("Y-m-d H:i:s"));
            $donationItem->save();
        } catch (Exception $e) {
            $donationItem->setStatus($donationStatus);
            $donationItem->setUpdatedAt($oldUpdatedAt);
            $donationItem->save(); //TODO: Better to handle things here with transactions
            Mage::log ("Error sending the donation from order {$orderId}", null, '2016.log');
        }
    }
    
    public function captureCancelDonation($observer)
    {
        $order = $observer->getEvent()->getOrder();
        
        if(!$order->getId()) {
            return; //Needed?
        }
        $donationItem = Mage::getModel('elefunds/donation');
        $donationItem->loadByAttribute('order_id', $order->getId());
        
        if (!$donationItem->getId()) {
            return;
        }
        
        $donationItem->setStatus(Knm_Elefunds_Model_Donation::STATUS_CANCELLED_CAPTURE);
        $order->addRelatedObject($donationItem);
        Mage::register('donation_item', $donationItem);
        $order->getResource()->addCommitCallback(array($this , 'sendCancelDonation'));
    }
    
    public function sendCancelDonation()
    {
        $helper = Mage::helper('elefunds');
        $facade = $helper->getElefundsFacade();
        //Get cached receivers and add them to the facade? need?
        
        $toSendDonations = Mage::getModel('elefunds/donation')->getCollection()
                        ->addFieldToFilter('status', Knm_Elefunds_Model_Donation::STATUS_CANCELLED_CAPTURE);
                        
        foreach($toSendDonations as $toSendDonation) {
            $orderId = $toSendDonation->getOrderId();
            $incrementId = Mage::getModel('sales/order')->load($orderId)->getIncrementId();
            $response=$facade->deleteDonation(intval($incrementId));//?I should give the donation id? whats that? The foreigId?
            //TODO: Factor out to function login. 
            $time = new DateTime();
            $logItem = Mage::getModel('elefunds/logs');
            $logItem->setRequest($incrementId)
                    ->setResponse($response)
                    ->setCreatedAt($time->format("Y-m-d H:i:s"));
            $logItem->save();
            $toSendDonation->setStatus(Knm_Elefunds_Model_Donation::STATUS_CANCELLED_SENT);
            $toSendDonation->setUpdatedAt($time->format("Y-m-d H:i:s"));
            $toSendDonation->save();
        }
        //Write the cancellation on the log. !!
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

