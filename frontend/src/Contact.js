import "./css/Contact.css";

function Contact() {
  return (
    <>
      <div class="item_title">联系我们</div>
      <div class="list">
        <div class="item address">
          地址: 1.Factory:Xinxing Industrial Park, Fufeng County New District,
          Baoji of Shaanxi Province <br />
          工厂地址:陕西省宝鸡市扶风县新区新兴产业园内
          <br /> <br />
          2.Office:12th Floor, Yuheng International, Intersection Of West Avenue
          And North Changxing Road, Xi`an, Shaanxi, China
          <br />
          办公室地址:陕西省西安市长安区长兴北路与西部大道交叉口宇恒国际12层{" "}
        </div>
        <div class="item phone">电话: +86-029-84193387 </div>
        <div class="item email">
          邮箱:
          <a
            class="footer_mail_mta"
            href="mailto:jeffery@zhongsheng-frp.com.cn"
          >
            jeffery@zhongsheng-frp.com.cn{" "}
          </a>
        </div>
      </div>
      <div class="clear"></div>
    </>
  );
}

export default Contact;
