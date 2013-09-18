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
use Lfnds\Facade;
use Lfnds\Template\Shop\Helper\RequestHelper;
use Lfnds\Template\Shop\CheckoutConfiguration;
use Lfnds\Template\Shop\CheckoutSuccessConfiguration;

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
     * @return Facade
     */
    public function getConfiguredFacade($checkoutSuccess = FALSE) {
        $configurationType = $checkoutSuccess ? 'CheckoutSuccess' : 'Checkout';

        if (!isset($this->facade[$configurationType])) {

            $magentoConfigBasePath = 'lfnds_donation/general';

            if ($checkoutSuccess) {
                require_once(Mage::getBaseDir('lib') . '/Lfnds/Template/Shop/CheckoutSuccessConfiguration.php');
                $configuration = new CheckoutSuccessConfiguration();
            } else {
                require_once(Mage::getBaseDir('lib') . '/Lfnds/Template/Shop/CheckoutConfiguration.php');
                $clientId = Mage::getStoreConfig($magentoConfigBasePath . '/client_id');
                $apiKey = Mage::getStoreConfig($magentoConfigBasePath . '/api_key');
                $countryCode = substr(Mage::app()->getLocale()->getLocaleCode(), 0, 2);

                $configuration = new CheckoutConfiguration();
                $configuration->setClientId($clientId)
                               ->setApiKey($apiKey)
                               ->setCountrycode($countryCode);
            }

            require_once(Mage::getBaseDir('lib') . '/Lfnds/Facade.php');
            $facade = new Facade($configuration);

            if ($configurationType === 'Checkout') {
                $theme = Mage::getStoreConfig($magentoConfigBasePath . '/theme');
                $color = Mage::getStoreConfig($magentoConfigBasePath . '/color');

                $localeCode = Mage::app()->getLocale()->getLocaleCode();
                $symbols = Zend_Locale_Data::getList($localeCode, 'symbols');

                if (preg_match('~^#(?:[0-9a-fA-F]{3}){1,2}$~', $color) !== 1) {
                    // If color is not a valid hexcode, we fallback to default.
                    $color = '#00efa2';
                }
                $facade->getConfiguration()->getView()->assignMultiple(
                    array(
                        'skin' => array(
                            'theme' =>  $theme,
                            'color' =>  $color
                        ),
                        'currencyDelimiter' => $symbols['decimal'],
                        'formSelector'      => '#donation-form',
                        'totalSelector'     => '#checkout-review-table tfoot tr.last .price',
                        'rowContainer'      => '#checkout-review-table tfoot tr.first',
                        'rowLabel'          => 'td:first-child',
                        'rowValue'          => 'td.last'
                    )
                );

                $facade->getConfiguration()->getView()->assign(
                    'skin',
                    array(
                        'theme' => $theme,
                        'color' => $color
                    )
                );

            }

            $this->facade[$configurationType] = $facade;
        }

        return $this->facade[$configurationType];
    }

    /**
     * A helper to verify the request for elefunds donations.
     *
     * @return RequestHelper
     */
    public function getRequestHelper() {
            $helperPath = Mage::getBaseDir('lib') . '/Lfnds/Template/Shop/Helper/RequestHelper.php';
            require_once $helperPath;

            return new RequestHelper();
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
        return FALSE;

        /**  +++ Disabled for 2.0.0 +++ *
        if ($this->usesOneStepCheckout === NULL) {
            $this->usesOneStepCheckout = Mage::getStoreConfig('lfnds_donation/advanced/uses_onestepcheckout');
        }
        return $this->usesOneStepCheckout;
         *  ^^^ Disabled for 2.0.0 ^^^ */
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

    /**
     * @return bool
     */
    public function isActive() {
        if ($this->active === NULL) {
            $this->active = Mage::getStoreConfig('lfnds_donation/general/active');
        }
        return $this->active;
    }

    /**
     * Deactivates the module.
     */
    public function deactivate() {
        $this->active = FALSE;
    }

}
