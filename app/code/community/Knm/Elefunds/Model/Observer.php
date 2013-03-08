<?php
/*
 * Observer.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */


class Knm_Elefunds_Model_Observer 
{
    
/*
 * name: addDonation
 * 
 * Add a virtual product representing the donation to the quote and 
 * assign it the value of the donation. 
 * 
 * @param      Varien_Event_Observer $observer
 * @author Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 * 
 */
    public function addDonation($observer)
    {
        $request = Mage::app()->getRequest();
        $quote=Mage::getSingleton('checkout/session')->getQuote();

        $path='elefunds/config/active';
        $active=Mage::getStoreConfig($path);

        
        //TODO: Refactor the dispatch _before_enable on Banner class 
        //          to check also here the activation of the module.
        if (!$active || !$request->has('elefunds_checkbox') || $request->getPost('elefunds_checkbox')!='on') {
            return;
        }
        
        $receivers = $request->getPost('elefunds_receiver');
        $donationAmountCents= (int)((float)$request->getPost('elefunds_donation_cent'));
        if (!isset($receivers) || empty($receivers) || !$donationAmountCents) {
            return;
        }
        
        $helper = Mage::helper('elefunds');
        $elefundsProduct = $helper->getVirtualProduct();
        if (!$elefundsProduct) {
            Mage::log('Elefunds object not found on store!!', null, '2016.log');            
        }
        
        if ($quote->hasProductId($elefundsProduct->getId())) {
            return; //Product is already in the cart. -- TODO: Update cart? --> getQuoteItem, update prices and save.
        }
        
        /*$cart = Mage::getSingleton('checkout/cart');
        $cart->addProduct($elefundsProduct, array('qty' => 1)); */
        $elefundsProduct->setPrice($donationAmountCents/100);
        $elefundsProduct->setBasePrice($donationAmountCents/100);
        $item=$quote->addProduct($elefundsProduct);

        //In case of problems with email templates, we can achieve the same result by : 
        /*if ($item instanceof Mage_Sales_Model_Quote_Item) {
            $item->setDescription(ELEFUNDSPRODUCTDESCRIPTION);
        }*/
        //Log the additional variables? ... or just on order creation success?
    }
    
    public function cleanDonation($observer)
    {
    	Mage::log("request", null, '2016.log');
        //$quote = $observer->getOnepage()->getQuote();
        //Never delete it from the Quote.? 
        
    }
    
    public function captureDonation($observer)
    {
        $request = Mage::app()->getRequest();
        $order= $observer->getEvent()->getOrder();
        $quote= $observer->getEvent()->getQuote();
        $id = $order->getId();
        
        if (!isset($id) || empty($id))  
            return; //There is not Order
            
            
        $helper = Mage::helper('elefunds');
        $virtualProduct=$helper->getVirtualProduct();
        if (!$virtualProduct) {
            //Product was destroyed? wrongly setup--> throw exception?
            return;
        }
        
        if (!$quote->hasProductId($virtualProduct->getId()))
            return; //There is not donation
            
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

