<?php 
/*
 * Banner.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */
 
class Knm_Elefunds_Block_Checkout_Banner extends Mage_Core_Block_Template 
{
    protected $showBanner=true;
    
   
    public function getApiTemplate()
    {
        $path='elefunds/config/active';
        $active=Mage::getStoreConfig($path);
        $this->canShowBanner($active);
        
        Mage::dispatchEvent('elefunds_checkout_review_before_enable', array('object' => $this));
        
        if ($this->canShowBanner()) {
            $helper = Mage::helper('elefunds');
            try {
                $facade = $helper->getElefundsFacade();
                $basePath='elefunds/config';
                $banner_width = Mage::getStoreConfig($basePath.'/banner_width');
                $total = Mage::getModel('checkout/cart')->getQuote()->getGrandTotal();
                //$convert = localeconv();
                $localeCode = Mage::app()->getLocale()->getLocaleCode();
                $symbols = Zend_Locale_Data::getList($localeCode, 'symbols');
                
                $receivers=$helper->getReceivers();

                if (!$receivers) {
                    throw new Exception("Elefunds error - Can not get receivers TEST");
                    return '';
                }

                $facade->getConfiguration()
                       ->getView()
                          ->assign('shopWidth', $banner_width)
                          ->assign('currencyDelimiter', $symbols['decimal'])
                          ->assign('total', $total*100)     //Cart amount is sent in cents? 
                          ->assign('receivers', $receivers);

                $template = $facade->renderTemplate();
            } catch (Exception $e) {
                Mage::log($e->getMessage(), null, '2016.log');

                Mage::log('Elefunds error - getting Facade object from helper', null, '2016.log');
                Mage::log('Elefunds error - couldnt get template', null, '2016.log');
                return '';
            }
            //return parent::_toHtml();
            return $template;
        }
        return '';
    }
    
    public function canShowBanner($value=null)
    {
        if (null!==$value) {
            $this->showBanner=$value;
        }
        return $this->showBanner;
    }
    
    
}
