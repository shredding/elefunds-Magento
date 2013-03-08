<?
/*
 * Socialmedia.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */

class Knm_Elefunds_Block_Checkout_Socialmedia extends Mage_Core_Block_Template 
{
    protected $_order;
    
    
    protected function _prepareLayout()
    {
        $headBlock = $this->getLayout()->createBlock('elefunds/page_head', 'elefunds.head');
        $this->getLayout()->getBlock('head')->setChild('elefunds.head', $headBlock);

        parent::_prepareLayout();
    }
    
    public function existDonation()
    {
        $helper = Mage::helper('elefunds');  //TODO: Refactor this into class variable to avoid multiple loading.
        $virtualProduct = $helper->getVirtualProduct();
        if (!$virtualProduct) {
            //throw exception??
            return false;
        }
        
        $order = $this->getOrder();
        if($order && $order->getItemsCollection()->getItemByColumnValue('product_id', $virtualProduct->getId())) {
                return true;
        }
        return false;
    }
    
    
    public function getOrder()
    {
        if (!$this->_order) {
            $orderId = Mage::getSingleton('checkout/session')->getLastRealOrderId();
            if ($orderId) {
                $order = Mage::getModel('sales/order')->loadByIncrementId($orderId);
                $this->_order = $order;
                if (!$order->getId())
                    $this->_order = null;
            }
        }
        return $this->_order;
    }
    
    public function renderSocialMedia()
    {
        $helper = Mage::helper('elefunds');
        $order = $this->getOrder();
        
        try {
            $facade = $helper->getElefundsFacade('CheckoutSuccess');
            $donationItem = Mage::getModel('elefunds/donation');
            $donationItem->loadByAttribute('order_id', $order->getId());
            if (!$donationItem->getId()) {
                //No donation Available -- Dont render anything. 
                return;
            }
            
            $receivers = $helper->getReceivers();
            $receiversArray = unserialize($donationItem->getReceivers());
            $receiversArray = array_flip($receiversArray);  //values and keys are unique!
            foreach ($receivers as $receiver) {
                if (array_key_exists($receiver->getId(), $receiversArray)) 
                    $receiversArray[$receiver->getId()]=$receiver->getName();
            }
            
            $facade->getConfiguration()->getView()->assign('foreignId', $order->getId());
            $facade->getConfiguration()->getView()->assign('receivers', $receiversArray);
            //TODO: Ask for the status of the donation? Rendersocialmedia is supposed to be used 
            //      only at the Success page. --> put on Function documentation? 
            $html = $facade->renderTemplate('CheckoutSuccess');
            
        } catch (Exception $e) {
            Mage::log('Elefunds: Success template couldnt be rendered.!!', null, '2016.log'); 
            return '';
        }
        return $html;
    }
}
