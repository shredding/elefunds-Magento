
<?php
/*
 * Data.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */

 
class Knm_Elefunds_Helper_Data extends Mage_Core_Helper_Abstract {
    protected $_virtualProduct;

    /* Gets the configurated Elefunds Facade Object to use on other positions
     * of Magento. 
     * 
     * @param
     * @trows       Library_Elefunds_Exception_ElefundsCommunicationException
     * @return      Library_Elefunds_Facade
     * @author Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
     * 
     */
    public function getElefundsFacade($configurationType = 'Checkout', $withReceivers = true) {
        $facadePath = Mage::getBaseDir('lib').DS.'Elefunds'.DS.'Facade.php';
        require_once $facadePath;

        $configPath = Mage::getBaseDir('lib').DS.'Elefunds'.DS.'Template';
        $configPath.=DS.'Shop'.DS.$configurationType.'Configuration.php';
        $className = 'Library_Elefunds_Template_Shop_'.$configurationType.'Configuration';

        switch ($configurationType) {
            case 'Checkout':
            case 'CheckoutSuccess':
                    if (!file_exists($configPath)) {
                        return null; //TODO: throw exception? no valid Configuration File.
                    }
                    include_once $configPath;
                    $configuration = new $className();
                    //$setupFunction = 'setupConfig'.$configurationType;
                    //$this->$setupFunction($configuration);
                    $this->setupConfigCheckout($configuration);
                    break;
            default:
                return null; //Needed? Throw exception? 
        }

        $facade = new Library_Elefunds_Facade($configuration);
        //TODO: Wait ultil shopname is added to $configuration into SDK, then 
        // move the setup of the shopname into the function setupConfigCheckout
        //$shopName=Mage::app()->getStore()->getName();
        //NOTE: Responsabilities of Configuration, Facade and View objects on SDK
        // should be improved and functionality isolated. so that this external 
        // assignments are not needed here. 
        
        $shopName=Mage::getStoreConfig('general/store_information/name');
        $donationEnabled = Mage::getStoreConfig('elefunds/config/donation_receipt');
        $configuration->getView()->assign('shopName', $shopName);
        $configuration->getView()->assign('offerDonationReceipt', isset($donationEnabled) ? $donationEnabled : FALSE);
        
        if ($withReceivers) {
            $receivers = $this->getReceivers();  //This should be moved to the facade? 
            $resp = array();
            foreach ($receivers as $receiver) {
                $resp[$receiver->getId()]=$receiver->getName();
            }
            $configuration->getView()->assign('receivers', $resp);
        }

        return $facade;
    }
    
    public function setupConfigCheckout($configuration) {
        //TODO: Validation of all the values comming from backend
        $basePath = 'elefunds/config';
        $clientId = Mage::getStoreConfig($basePath.'/client_id');
        $apiKey=Mage::getStoreConfig($basePath.'/api_key');
        $countryCode = Mage::app()->getLocale()->getLocaleCode();
        $countryCode = substr($countryCode, 0, 2);

        if ($apiKey && $clientId) {
            $configuration->setClientId($clientId)
                            ->setApiKey($apiKey)
                            ->setCountrycode($countryCode);
        }
    }
    
    public function getReceivers() {
        $time = new DateTime(); //date("Y-m-d H:i:s");
        
        $receiversLocal = Mage::getModel('elefunds/receivers')->getCollection();
        $receiversLocal->addFieldToFilter(
            'valid', array(
                'from'=>$time->format("Y-m-d H:i:s")
        ));
        $size = $receiversLocal->getSize();
        if ($size < 3) {
            //Update or add new receivers by calling the api. 
            try {
                $facade = $this->getElefundsFacade('Checkout', false);
                $receivers = $facade->getReceivers();
                if (!$receivers || !is_array($receivers)) {
                    $receivers = array ($receivers);
                }
                foreach ($receivers as $receiver) {
                    $receiverItem = Mage::getModel('elefunds/receivers')->load($receiver->getId(), 'receiver_id');
                    $receiverItem->setReceiverId($receiver->getId())
                                ->setName($receiver->getName())
                                ->setCountry($facade->getConfiguration()->getCountrycode())
                                ->setDescription($receiver->getDescription())
                                ->setImageUrl(serialize($receiver->getImages()))
                                ->setValid($receiver->getValidTime()->format("Y-m-d H:i:s"));
                    $receiverItem->save();
                }
            } catch (Exception $e) {
                Mage::log("ELEFUNDS: Receivers couldnt be retrieved", null, '2016.log');
                return array();
            }
        }
        
        $size = $receiversLocal->getSize();
        if ($size < 3) {
            Mage::log("ELEFUNDS: Receivers couldnt be retrieved", null, '2016.log');
            return array();
        }
        $facade = $this->getElefundsFacade('Checkout', false);
        $receivers = array();
        foreach ($receiversLocal as $receiverLocal) {
            $valid = DateTime::createFromFormat("Y-m-d H:i:s", $receiverLocal->getValid());
            $receiver = $facade->createReceiver();
            $imagesArray = unserialize($receiverLocal->getImageUrl());
            $receivers[] = $receiver->setId((int)$receiverLocal->getReceiverId())
                                    ->setName($receiverLocal->getName())
                                    ->setDescription($receiverLocal->getDescription())
                                    ->setImages($imagesArray)
                                    ->setValidTime($valid);
            
        }
        return $receivers;
    }

    /**
     * @return Mage_Core_Model_Abstract|null
     */
    public function getVirtualProduct() {
        $sku = $this->getVirtualProductSku();
        
        //Load product should be done this way, so stock info is loaded
        $virtualProduct = Mage::getModel('catalog/product');
        $id = $virtualProduct->getIdBySku($sku);
        if (!$id) {
            $this->_virtualProduct = null;
            return null;
        }
        $this->_virtualProduct = $virtualProduct->load($id);
        
        if (!$this->_virtualProduct->getId()) {
        }
        
        return $this->_virtualProduct;
    }
    
    public function getVirtualProductSku() {
        $key = 'elefunds/config/product';
        
        if (!($sku = Mage::getStoreConfig($key))) {
            $sku = 'donation';
        }
        
        return $sku;
    }
}

?>
