<?php

class Knm_Elefunds_Adminhtml_LogsController extends Mage_Adminhtml_Controller_Action
{
    public function indexAction()
    {
        $this->loadLayout();
        $this->_setActiveMenu('elefunds');
        $this->renderLayout();
    }
}