<?php

/**
 * IndexController
 *
 * Renders our view
 *
 * Controller is registered in ../etc/config.xml
 * The rendered View is also defined in ../etc/config.xml (layout)
 *
 * @package    elefunds Magento Module
 * @author     Raul Armando Salamanca Gonzalez <raul.salamanca@gmx.de>
 * @copyright  2012 elefunds GmbH <hello@elefunds.de>
 * @license    http://www.opensource.org/licenses/BSD-3-Clause  The BSD 3-Clause License
 * @link       http://www.elefunds.de
 */
class Lfnds_Donation_IndexController extends Mage_Core_Controller_Front_Action {

    /**
     * The default Action for any controller
     * Loads and renders the layout
     */
    public function indexAction() {
        $this->loadLayout();
        $this->renderLayout();
    }
}
