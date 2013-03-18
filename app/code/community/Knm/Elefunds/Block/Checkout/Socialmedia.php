<?
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
class Knm_Elefunds_Block_Checkout_Socialmedia extends Mage_Core_Block_Template {

    protected $_order;

    /** @todo analyze this */
    protected function _prepareLayout() {
        $headBlock = $this->getLayout()->createBlock('elefunds/page_head', 'elefunds.head');
        $this->getLayout()->getBlock('head')->setChild('elefunds.head', $headBlock);

        parent::_prepareLayout();
    }
    
    public function existDonation() {
        try {
            $helper = Mage::helper('elefunds');  //TODO: Refactor this into class variable to avoid multiple loading.
            $virtualProduct = $helper->getVirtualProduct();

            if (!$virtualProduct) {
                throw new Exception("Elefunds error - Can not get virtual product");
            }

            $order = $this->getOrder();

            if ($order && $order->getItemsCollection()->getItemByColumnValue('product_id', $virtualProduct->getId())) {
                return true;
            }
            return false;
        } catch (Exception $e) {
            Mage::log($e->getMessage(), null, '2016.log');
            return false;
        }
    }

    public function getOrder() {
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
    
    public function renderSocialMedia() {
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
            Mage::log('Elefunds: Success template could not be rendered.!!', null, '2016.log');
            return '';
        }
        return $html;
    }
}
