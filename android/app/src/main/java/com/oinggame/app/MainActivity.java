package com.oinggame.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 웹뷰는 기본적으로 기기의 글꼴 크기 설정을 글자에만 곱한다. 화면
        // 크기를 키워둔 폰에서는 점수·시간·콤보 숫자만 훌쩍 커지고, 그 숫자를
        // 담는 판과 여백은 vw/dvh로 잡혀 있어 그대로라, 글자가 칸을 밀고
        // 나가거나 잘린다. 같은 빌드가 폰마다 다르게 보이던 이유다.
        //
        // 이 게임은 화면 전체가 한 장의 그림처럼 짜인 고정 판이라 글자만
        // 따로 커지면 배치가 무너진다. 그래서 글자 배율을 100으로 고정한다.
        // 대신 글자 크기 자체는 어느 기기에서나 화면 폭에 비례하도록
        // 이미 clamp로 잡혀 있어서, 큰 화면에서는 큰 글자가 나온다.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().getSettings().setTextZoom(100);
        }
    }
}
