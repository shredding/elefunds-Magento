<?php 

/**
 * Banner
 *
 * Resposible for preparing Data for showing the Donation Banner
 *
 * @package    elefunds Magento Module
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 */
class Knm_Elefunds_Block_Checkout_Banner extends Mage_Core_Block_Template {

    /**
     * Control if banner should be shown
     *
     * @var bool
     */
    protected $showBanner = true;

    /**
     * Returns the API Template
     * Used and shown in /design/frontend/base/default/template/knm/elefunds/checkout/onepage/review/donation_banner.phtml
     *
     * @return string The rendered HTML Snippet
     */
    public function getApiTemplate() {
        $path = 'elefunds/config/active';
        $active = Mage::getStoreConfig($path);
        $this->canShowBanner($active);
        
        Mage::dispatchEvent('elefunds_checkout_review_before_enable', array('object' => $this));
        
        if ($this->canShowBanner()) {
            $helper = Mage::helper('elefunds');
            try {
                $facade = $helper->getElefundsFacade();
                $basePath='elefunds/config';
                $banner_width = Mage::getStoreConfig($basePath.'/banner_width');
                $total = Mage::getModel('checkout/cart')->getQuote()->getGrandTotal();
                $localeCode = Mage::app()->getLocale()->getLocaleCode();
                $symbols = Zend_Locale_Data::getList($localeCode, 'symbols');
                
                $receivers = $helper->getReceivers();

                if (!$receivers) {
                    throw new Exception("Elefunds error - Can not get receivers");
                }

                $facade->getConfiguration()
                       ->getView()
                          ->assign('shopWidth', $banner_width)
                          ->assign('currencyDelimiter', $symbols['decimal'])
                          ->assign('total', $total*100)
                          ->assign('receivers', $receivers);

                $template = $facade->renderTemplate();
            } catch (Exception $e) {
                Mage::log($e->getMessage(), null, '2016.log');

                Mage::log('Elefunds error - getting Facade object from helper', null, '2016.log');
                Mage::log('Elefunds error - couldnt get template', null, '2016.log');
                return '';
            }
            return $template;
        }
        return '';
    }

    /**
     *
     * @param int $value
     * @return int
     */
    public function canShowBanner($value = null) {
        if (null !== $value) {
            $this->showBanner = $value;
        }
        return $this->showBanner;
    }
    
    
}
