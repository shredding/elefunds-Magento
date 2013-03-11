<?php
/**
 * Head
 *
 * Responsible for preparing Data for the page head
 *
 * @package    elefunds Magento Module
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 */
class  Knm_Elefunds_Block_Page_Head extends Mage_Core_Block_Template {

    /**
     * Gets CSS- and Javascript-files from the Elefunds Facade and adds them to the head block
     */
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
            $headBlock->addItem('skin_js', 'js'.DS.'knm_elefunds'.DS.basename($jsFile));
        }
        foreach ($cssFiles as $cssFile) {
            $headBlock->addCss('css'.DS.'knm_elefunds'.DS.basename($cssFile));
        }
        
        parent::_prepareLayout();        
    }
}
