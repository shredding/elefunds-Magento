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
class Lfnds_Donation_Block_Page_Head extends Mage_Core_Block_Template {

    /**
     * Gets CSS- and Javascript-files from the Elefunds Facade and adds them to the head block
     */
    protected function _prepareLayout() {

        /** @var Lfnds_Donation_Helper_Data $helper */
        $helper = Mage::helper('lfnds_donation');
        $headBlock = $this->getLayout()->getBlock('head');

        try {
            $includeJQuery = Mage::getStoreConfig('lfnds_donation/advanced/include_jquery');

            $facade = $helper->getConfiguredFacade();

            // Javascript includes
            $scriptFiles = $facade->getTemplateJavascriptFiles();

            if ($includeJQuery) {
                array_unshift($scriptFiles, 'jQueryNoConflict.js');
                array_unshift($scriptFiles, 'jquery-1.9.1.min.js');
            }

            foreach ($scriptFiles as $jsFile) {
                $headBlock->addItem('skin_js', 'js' . DS . 'lfnds_donation' . DS . basename($jsFile));
            }

            if ($helper->isOneStepCheckoutInstalled()) {
                $jsAdditional = '/elefunds_magento_onestep_additional.js';
                $headBlock->addItem('skin_js', 'js' . DS . 'lfnds_donation' . DS . 'additional' . DS . basename($jsAdditional));
            }

            // CSS included
            // This CSS is not used in OneStepCheckout
            // Check layout/lfnds_donation.xml for OneStepCheckout CSS
            if (!$helper->isOneStepCheckoutInstalled()) {
                $cssFiles = $facade->getTemplateCssFiles();
                foreach ($cssFiles as $cssFile) {
                    $headBlock->addCss('css' . DS . 'lfnds_donation' . DS . basename($cssFile));
                }
            } else {
                $headBlock->addCss('css' . DS . 'lfnds_donation' . DS . 'additional' . DS . 'elefunds_magento_onestep_additional.css');
            }


        } catch (Exception $exception) {
            Mage::logException($exception);
        }
        parent::_prepareLayout();
    }
}
