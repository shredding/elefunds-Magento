<?php
/**
 * Email
 *
 * Responsible for preparing Data for the Email Block
 *
 * @package    elefunds Magento Module
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 */
class Knm_Elefunds_Block_Sales_Order_Email extends Mage_Core_Block_Template {
    protected function _toHtml() {
        $helper = Mage::helper('elefunds') ;
        $sku = $helper->getVirtualProductSku();
        
        $item = $this->getLayout()->getBlock('additional.product.info')->getItem();
        
        if ($item->getSku() === $sku) {
            return parent::_toHtml();
        }
        return '';
    }
}
