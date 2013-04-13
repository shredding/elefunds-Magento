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

/**
 * General helper function to access and configure the SDK in magento
 *
 * @package    elefunds Magento Module
 * @subpackage Helper
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>, Christian Peters <christian@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Lfnds_Donation_Helper_Data extends Mage_Core_Helper_Abstract {

    /**
     * @var Mage_Catalog_Model_Product
     */
    protected $virtualProduct;

    /**
     * @var array
     */
    protected $facade = array();

    /**
     * @var Elefunds_Template_Shop_Helper_RequestHelper
     */
    protected $requestHelper;

    /**
     * @var array
     */
    protected $receivers;

    /**
     * @var Lfnds_Donation_Manager_SyncManager
     */
    protected $syncManager;

    /**
     * @var bool
     */
    protected $usesOneStepCheckout;

    /**
     * @var bool
     */
    protected $active;

    /**
     * Configures the facade based on the plugin settings and the current locale.
     *
     * @param bool $checkoutSuccess
     * @param bool $autoFetchReceivers
     * @return Elefunds_Facade
     */
    public function getConfiguredFacade($checkoutSuccess = FALSE, $autoFetchReceivers = TRUE) {
        $configurationType = $checkoutSuccess ? 'CheckoutSuccess' : 'Checkout';

        if (!isset($this->facade[$configurationType])) {

            $configPath = Mage::getBaseDir('lib') . DS . 'Elefunds' . DS . 'Template'
                        . DS . 'Shop' . DS . $configurationType . 'Configuration.php';
            $facadePath = Mage::getBaseDir('lib') . DS . 'Elefunds' . DS . 'Facade.php';

            $className = 'Elefunds_Template_Shop_'.$configurationType.'Configuration';

            require_once($facadePath);
            require_once($configPath);

            /** @var Elefunds_Configuration_ConfigurationInterface $configuration  */
            $configuration = new $className();

            $magentoConfigBasePath = 'lfnds_donation/general';
            $clientId = Mage::getStoreConfig($magentoConfigBasePath . '/client_id');
            $apiKey = Mage::getStoreConfig($magentoConfigBasePath . '/api_key');
            $countryCode = substr(Mage::app()->getLocale()->getLocaleCode(), 0, 2);

            $configuration->setClientId($clientId)
                          ->setApiKey($apiKey)
                          ->setCountrycode($countryCode);

            $theme = Mage::getStoreConfig($magentoConfigBasePath . '/theme');
            $color = Mage::getStoreConfig($magentoConfigBasePath . '/color');


            $facade = new Elefunds_Facade($configuration);
            $facade->getConfiguration()->getView()->assign(
                'skin',
                array(
                    'theme' => $theme,
                    'color' => $color
                )
            );

            $this->facade[$configurationType] = $facade;
        }

        return $this->facade[$configurationType];
    }

    /**
     * A helper to verify the request for elefunds donations.
     *
     * @param array $request
     * @return Elefunds_Template_Shop_Helper_RequestHelper
     */
    public function getRequestHelper(array $request = array()) {
        if ($this->requestHelper === NULL) {
            $helperPath = Mage::getBaseDir('lib') . DS . 'Elefunds' . DS . 'Template'
                . DS . 'Shop' . DS . 'Helper' . DS . 'RequestHelper.php';
            require_once $helperPath;
            $this->requestHelper = new Elefunds_Template_Shop_Helper_RequestHelper();
        }
        $this->requestHelper->setRequest($request);
        return $this->requestHelper;
    }


    /**
     * Returns a valid set of receivers.
     *
     * @return array
     */
    public function getReceivers() {

        if ($this->receivers === NULL) {
            $time = new DateTime();

            /** @var Lfnds_Donation_Model_Mysql4_Receiver_Collection $receiversCollection  */
            $receiversCollection = Mage::getModel('lfnds_donation/receiver')->getCollection();


            $receiversCollection->addFieldToFilter(
                'valid', array(
                           'from'  =>  $time->format("Y-m-d H:i:s")
                 )
            )
            ->addFieldToFilter('countrycode', substr(Mage::app()->getLocale()->getLocaleCode(), 0, 2));

            try {
                if ($receiversCollection->getSize() < 3) {
                    $this->receivers = $this->getSyncManager()->syncReceivers();

                    if (count($this->receivers) < 3) {
                        // Okay, this line of code will hopefully never execute! We do ALWAYS provide three receivers.
                        $this->receivers = array();
                    }
                } else {
                    $this->receivers = $receiversCollection;
                }
            } catch (Exception $exception) {
                Mage::logException($exception);
                Mage::log('Elefunds database tables not available or module improperly configured.');

                $this->receivers = array();
            }


        }

        return $this->receivers;
    }

    /**
     * Returns the available receiver ids
     *
     * @return array
     */
    public function getAvailableReceiverIds() {
        $ids = array();
        /** @var Lfnds_Donation_Model_Mysql4_Receiver_Collection $receiversCollection  */
        $receiversCollection = Mage::getModel('lfnds_donation/receiver')->getCollection();
        $receiversCollection->addFieldToFilter('countrycode', substr(Mage::app()->getLocale()->getLocaleCode(), 0, 2));

        /** Lfnds_Donation_Model_Receiver $receiver */
        foreach ($receiversCollection as $receiver) {
            $ids[] = $receiver->getReceiverId();
        }
        return $ids;
    }

    /**
     * Retrieves the virtual product.
     *
     * @return Mage_Catalog_Model_Product
     */
    public function getVirtualProduct() {
        /** @var Mage_Catalog_Model_Product $productModel */
        $productModel = Mage::getModel('catalog/product');
        $id = $productModel->getIdBySku(Lfnds_Donation_Model_Donation::ELEFUNDS_VIRTUAL_PRODUCT_SKU);
        if (!$id) {
            $this->virtualProduct = NULL;
        } else {
            $this->virtualProduct = $productModel->load($id);
        }

        return $this->virtualProduct;
    }

    public function getSyncManager() {
        if ($this->syncManager === NULL) {
            $this->syncManager = new Lfnds_Donation_Manager_SyncManager($this->getConfiguredFacade());
        }

        return $this->syncManager;
    }

    /**
     * Returns the setted state of the one step checkout in the backend.
     *
     * @return bool
     */
    public function isOneStepCheckoutInstalled() {
        if ($this->usesOneStepCheckout === NULL) {
            $this->usesOneStepCheckout = Mage::getStoreConfig('lfnds_donation/advanced/uses_onestepcheckout');
        }
        return $this->usesOneStepCheckout;
    }

    /**
     * @return array
     */
    public function getExcludedPaymentMethods() {
        $path = 'lfnds_donation/advanced/excluded_payment_methods';
        $storeId = Mage::app()->getStore()->getId();

        $excludedMethodsAsString = Mage::getStoreConfig($path, $storeId);
        return !empty($excludedMethodsAsString) ? explode(',', $excludedMethodsAsString) : array();
    }

    public function isActive() {
        if ($this->active === NULL) {
            $this->active = Mage::getStoreConfig('lfnds_donation/general/active');
        }
        return $this->active;
    }

}
