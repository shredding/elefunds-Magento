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
 * @subpackage Block
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>, Christian Peters <christian@elefunds.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 * @since      File available since Release 1.0.0
 */
class Lfnds_Donation_Block_Checkout_Banner extends Mage_Core_Block_Template {

    /**
     * @var Lfnds_Donation_Helper_Data $helper
     */
    protected $helper;

    /**
     * @var string
     */
    protected $position;

    public function __construct() {
        $this->helper = Mage::helper('lfnds_donation');
    }

    public function getPosition() {
        if ($this->position === NULL) {
            $this->position  = Mage::getStoreConfig('lfnds_donation/advanced/banner_position');
        }
        return $this->position;
    }

    /**
     * Returns the API Template.
     *
     * If we cannot display the Template, we return an empty string.
     *
     * Used and shown in /design/frontend/base/default/template/lfnds/donation/checkout/onepage/review/donation_banner.phtml
     *
     * @return string The rendered HTML Snippet
     */
    public function getApiTemplate() {

        if (!$this->helper->isOneStepCheckoutInstalled()) {
            // The event does not work with one step checkout.
            // That's because the payment methods are not configured prior to the module.
            Mage::dispatchEvent('elefunds_checkout_review_before_enable', array('object' => $this));
        } else {
            $this->helper->getConfiguredFacade()->getConfiguration()->getView()->assign('toolTipPosition', 'right');
        }
        $template = '';

        if ($this->helper->isActive()) {

            try {
                $facade = $this->helper->getConfiguredFacade();

                $banner_width = Mage::getStoreConfig('lfnds_donation/advanced/banner_width');
                $total = Mage::getModel('checkout/cart')->getQuote()->getGrandTotal();
                $localeCode = Mage::app()->getLocale()->getLocaleCode();
                $symbols = Zend_Locale_Data::getList($localeCode, 'symbols');
                
                $receivers = $this->helper->getReceivers();

                if (count($receivers) >= 3) {

                    $facade->getConfiguration()
                           ->getView()
                              ->assign('shopWidth', $banner_width)
                              ->assign('currencyDelimiter', $symbols['decimal'])
                              ->assign('total', round($total * 100))
                              ->assign('receivers', $receivers);

                    $template = $facade->renderTemplate();

                }
            } catch (Elefunds_Exception_ElefundsCommunicationException $exception) {
                Mage::logException($exception);
            }
        }
        return $template;
    }

    public function getExcludedPaymentMethods() {
        return $this->helper->getExcludedPaymentMethods();
    }

    /**
     * Returns true if the elefunds plugin can be displayed.
     *
     * @return bool
     */
    public function canShowBanner() {
        return $this->helper->isActive();
    }

    public function deactivateBanner() {
        $this->helper->deactivate();
    }
    
    
}
