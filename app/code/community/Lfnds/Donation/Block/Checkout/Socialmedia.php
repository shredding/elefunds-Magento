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
class Lfnds_Donation_Block_Checkout_Socialmedia extends Mage_Core_Block_Template {

    /**
     * @var Mage_Sales_Model_Order
     */
    protected $order;

    /**
     * @var Lfnds_Donation_Helper_Data
     */
    protected $helper;

    protected $json;

    public function __construct() {
        $this->helper = Mage::helper('lfnds_donation');
    }

    public function canRenderSocialMedia() {

        /** @var Facade $facade  */
        $facade = $this->helper->getConfiguredFacade(TRUE);

        $donationItem = Mage::getModel('lfnds_donation/donation');

        $orderId = Mage::getSingleton('checkout/session')->getLastRealOrderId();
        $order = NULL;
        if ($orderId) {
            $order = Mage::getModel('sales/order')->loadByIncrementId($orderId);
            if (!$order->getId()) {
                return FALSE;
            }
        }

        /** @var Lfnds_Donation_Model_Donation $donationItem */
        $donationItem->loadByAttribute('foreign_id', $order->getIncrementId());

        if ($donationItem->getId()) {
            $facade->getConfiguration()->getView()->assign('foreignId', $donationItem->getForeignId());
            $assigns = $facade->getConfiguration()->getView()->getAssignments();
            $this->json = json_encode($assigns);
            return TRUE;
        }
        return FALSE;
    }

    /**
     * Renders the social media template or returns an empty string if we do have nothing to show.
     *
     * @return string
     */
    public function getJson() {
        return $this->json;
    }
}
