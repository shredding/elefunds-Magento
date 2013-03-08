<?php

class Knm_Elefunds_IndexController extends Mage_Core_Controller_Front_Action
{
    public function indexAction()
    {
/*        $logs = Mage::getModel('elefunds/logs');
        print_r($logs);
        die(1);
*/
        $this->loadLayout();
        $this->renderLayout();
    }
    
    public function testAction()
    {
       /* echo "hola";
        $receiver = Mage::getModel('elefunds/receivers');
        $time = new DateTime();
        $receiver->setReceiverId(1)
                ->setName('Namesito')
                ->setCountrycode('co')
                ->setDescription('Mydescription')
                ->setImageUrl('http://semolution.biz')
                ->setValid($time->format("Y-m-d H:i:s"));
                
        $receiver->save();
        

        $elemodel=Mage::getModel('elefunds/donation');
        
        $elemodel->setOrderId(100)
                    ->setStoreId(1)
                    ->setAmount('1009')
                    ->setSuggestedAmount('1009')
                    ->setStatus(Knm_Elefunds_Model_Donation::STATE_NEW)
                    ->setReceivers(serialize(array()))
                    ->setCreatedAt(date("Y-m-d H:i:s"))
                    ->setUpdatedAt(date("Y-m-d H:i:s"));
                    
        $elemodel->save();
        Mage::log($elemodel, null, '2016.log'); 
        */
        
    }
}
