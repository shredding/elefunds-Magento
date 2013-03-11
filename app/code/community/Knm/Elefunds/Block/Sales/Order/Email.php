<?php

/*
 * Email.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
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
