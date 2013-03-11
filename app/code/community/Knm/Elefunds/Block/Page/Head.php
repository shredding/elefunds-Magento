<?php
/*
 * Head.php
 * 
 * Copyright 2013 Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 */
 

class  Knm_Elefunds_Block_Page_Head extends Mage_Core_Block_Template {
    protected function _prepareLayout() {
        $helper = Mage::helper('elefunds');
        $headBlock = $this->getLayout()->getBlock('head');
        try {
            $facade = $helper->getElefundsFacade();
            $scriptFiles = $facade->getTemplateJavascriptFiles();
            $cssFiles = $facade->getTemplateCssFiles();
        } catch (Exception $e) {
            Mage::log('Elefunds error - getting Facade object from helper', null, '2016.log');
            Mage::log('Elefunds error - getting JS or CSS', null, '2016.log');
            Mage::log($e->getMessage(), null, '2016.log');
            //TODO: On the final version of the Module, just return on Exception
            parent::_prepareLayout();  
            return;
        }
        
        array_unshift($scriptFiles, 'jquery-1.9.1.min.js');
        foreach ($scriptFiles as $jsFile) {
            //$headBlock->addJs('knm_elefunds'.DS.basename($jsFile));
            $headBlock->addItem('skin_js', 'js'.DS.'knm_elefunds'.DS.basename($jsFile));
        }
        foreach ($cssFiles as $cssFile) {
            $headBlock->addCss('css'.DS.'knm_elefunds'.DS.basename($cssFile));
        }

        Mage::log($scriptFiles, null, '2016.log'); 
        Mage::log($cssFiles, null, '2016.log'); 
        
        parent::_prepareLayout();        
    }
}
